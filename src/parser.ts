import { Token, TokenType, SourceLocation } from './types';
import * as AST from './ast';

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): AST.Module {
    const location = this.currentLocation();
    const imports: AST.ImportDeclaration[] = [];
    const definitions: AST.Declaration[] = [];
    const contingencies: AST.Contingency[] = [];
    const primaryExpressions: AST.Expression[] = [];

    // Parse imports (must come first)
    while (!this.isAtEnd() && this.check(TokenType.SIGIL_IMPORT)) {
      imports.push(this.parseImport());
    }

    // Parse definitions (structs, functions, bindings)
    while (!this.isAtEnd() && this.isDefinition()) {
      definitions.push(this.parseDefinition());
    }

    // Parse primary expressions (multiple statements allowed)
    while (!this.isAtEnd() && !this.check(TokenType.ON) && !this.check(TokenType.ROUTE)) {
      primaryExpressions.push(this.parseExpression());
    }

    // Parse contingencies (on handlers and outcome matches at module level)
    while (!this.isAtEnd()) {
      if (this.check(TokenType.ON)) {
        contingencies.push(this.parseOnHandler());
      } else if (this.check(TokenType.ROUTE)) {
        contingencies.push(this.parseRouteDeclaration());
      } else if (this.check(TokenType.BAR)) {
        contingencies.push(this.parseOutcomeMatch());
      } else {
        this.error('Unexpected token at module level. Expected "on" handler or outcome match.');
      }
    }

    return {
      type: 'Module',
      location,
      imports,
      definitions,
      primaryExpressions,
      contingencies
    };
  }

  // ============================================================================
  // Imports
  // ============================================================================

  private parseImport(): AST.ImportDeclaration {
    const location = this.currentLocation();
    this.consume(TokenType.SIGIL_IMPORT, 'Expected i:');

    // Module path can be identifier (core, math) or string literal ("./utils.stm")
    let modulePath: string;
    if (this.check(TokenType.STRING)) {
      modulePath = this.advance().value;
    } else if (this.check(TokenType.IDENTIFIER)) {
      modulePath = this.advance().value;
    } else {
      this.error('Expected module name or file path after i:');
      modulePath = '';
    }

    // Optional selective imports: add, mul, print (comma-separated)
    let imports: string[] | null = null;
    if (this.check(TokenType.IDENTIFIER) && !this.checkIdentifier('as')) {
      imports = [];
      imports.push(this.advance().value);
      
      while (this.match(TokenType.COMMA)) {
        if (this.check(TokenType.IDENTIFIER)) {
          imports.push(this.advance().value);
        } else {
          this.error('Expected function name after comma in import list');
        }
      }
    }

    // Optional alias: as identifier
    let alias: string | null = null;
    if (this.checkIdentifier('as')) {
      this.advance(); // consume 'as'
      alias = this.consume(TokenType.IDENTIFIER, 'Expected alias name after "as"').value;
    }

    return {
      type: 'ImportDeclaration',
      location,
      modulePath,
      imports,
      alias
    };
  }

  // ============================================================================
  // Definitions
  // ============================================================================

  private isDefinition(): boolean {
    return (
      this.check(TokenType.SIGIL_STRUCT) ||
      this.check(TokenType.SIGIL_FUNCTION) ||
      this.check(TokenType.REC) ||
      this.check(TokenType.SIGIL_BINDING) ||
      this.check(TokenType.COLON)
    );
  }

  private parseDefinition(): AST.Declaration {
    if (this.check(TokenType.SIGIL_STRUCT)) {
      return this.parseStructDeclaration();
    } else if (this.check(TokenType.SIGIL_FUNCTION) || this.check(TokenType.REC)) {
      return this.parseFunctionDeclaration();
    } else {
      return this.parseBindingDeclaration();
    }
  }

  private parseStructDeclaration(): AST.StructDeclaration {
    const location = this.currentLocation();
    this.consume(TokenType.SIGIL_STRUCT, 'Expected s:');
    
    const nameToken = this.consume(TokenType.TYPE_NAME, 'Expected type name');
    const name = nameToken.value;
    
    this.consume(TokenType.LBRACE, 'Expected {');
    
    const fields: AST.StructField[] = [];
    
    // Handle indentation
    if (this.match(TokenType.INDENT)) {
      while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
        const fieldName = this.consume(TokenType.IDENTIFIER, 'Expected field name').value;
        this.consume(TokenType.COLON, 'Expected :');
        const typeName = this.consume(TokenType.TYPE_NAME, 'Expected type name').value;
        fields.push({ name: fieldName, typeName });
      }
      this.consume(TokenType.DEDENT, 'Expected dedent');
    }
    
    this.consume(TokenType.RBRACE, 'Expected }');
    
    return {
      type: 'StructDeclaration',
      location,
      name,
      fields
    };
  }

  private parseFunctionDeclaration(): AST.FunctionDeclaration {
    const location = this.currentLocation();
    const isRecursive = this.match(TokenType.REC);
    
    this.consume(TokenType.SIGIL_FUNCTION, 'Expected f:');
    const name = this.consume(TokenType.IDENTIFIER, 'Expected function name').value;
    
    // Parse parameters (space-separated identifiers before =>)
    const params: string[] = [];
    while (!this.check(TokenType.ARROW) && !this.check(TokenType.EMIT_CONTRACT) && !this.isAtEnd()) {
      if (this.check(TokenType.IDENTIFIER)) {
        params.push(this.advance().value);
      } else {
        break;
      }
    }
    
    // Parse emission contract (~> @"stream", ...)
    let emissionContract: string[] | null = null;
    if (this.match(TokenType.EMIT_CONTRACT)) {
      emissionContract = [];
      
      // Expect @"stream"
      this.consume(TokenType.AT, 'Expected @ after ~>');
      emissionContract.push(this.consume(TokenType.STRING, 'Expected stream name').value);
      
      // Additional streams separated by commas
      while (this.match(TokenType.COMMA)) {
        this.consume(TokenType.AT, 'Expected @');
        emissionContract.push(this.consume(TokenType.STRING, 'Expected stream name').value);
      }
    }
    
    this.consume(TokenType.ARROW, 'Expected =>');
    
    // Parse body (can be single expression or indented body)
    let body: AST.Expression | AST.IndentedBody;
    if (this.check(TokenType.INDENT)) {
      body = this.parseIndentedBody();
    } else {
      body = this.parseExpression();
    }
    
    return {
      type: 'FunctionDeclaration',
      location,
      isRecursive,
      name,
      params,
      emissionContract,
      body
    };
  }

  private parseBindingDeclaration(): AST.BindingDeclaration {
    const location = this.currentLocation();
    const hasExplicitSigil = this.match(TokenType.SIGIL_BINDING);
    
    this.consume(TokenType.COLON, 'Expected :');
    const name = this.consume(TokenType.IDENTIFIER, 'Expected binding name').value;
    const value = this.parseExpression();
    
    return {
      type: 'BindingDeclaration',
      location,
      name,
      value,
      hasExplicitSigil
    };
  }

  private parseIndentedBody(): AST.IndentedBody {
    const location = this.currentLocation();
    this.consume(TokenType.INDENT, 'Expected indent');
    
    const statements: (AST.BindingDeclaration | AST.Expression)[] = [];
    
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      if (this.check(TokenType.COLON) || this.check(TokenType.SIGIL_BINDING)) {
        statements.push(this.parseBindingDeclaration());
      } else {
        statements.push(this.parseExpression());
      }
    }
    
    this.consume(TokenType.DEDENT, 'Expected dedent');
    
    return {
      type: 'IndentedBody',
      location,
      statements
    };
  }

  // ============================================================================
  // Expressions
  // ============================================================================

  private parseExpression(parseOutcomeMatches: boolean = true): AST.Expression {
    return this.parseParallelOrPipe(parseOutcomeMatches);
  }

  private parseParallelOrPipe(parseOutcomeMatches: boolean = true): AST.Expression {
    const location = this.currentLocation();
    
    // Parse first branch/expression
    const first = this.parsePipeChain(false, parseOutcomeMatches);
    
    // Check for PP (parallel composition)
    if (this.check(TokenType.PP)) {
      const branches = [this.ensurePipeExpression(first, location)];
      
      // Collect all PP branches  
      while (this.match(TokenType.PP)) {
        // When parsing branches, stop before the gathering pipe
        const branch = this.parsePipeChainForBranch();
        branches.push(this.ensurePipeExpression(branch, this.currentLocation()));
      }
      
      // Gathering pipe (|> or |?>)
      const isPartial = this.match(TokenType.PIPE_PARTIAL);
      if (!isPartial) {
        this.consume(TokenType.PIPE, 'Expected |> or |?> after PP');
      }
      
      // Parse the gathering pipeline (might be a chain)
      const gatherTarget = this.parsePipeChain(false, parseOutcomeMatches);
      
      // Extract stream emit if the target is a PipeExpression
      let streamEmit: AST.StreamEmit | null = null;
      let finalTarget: AST.Expression = gatherTarget;
      if (gatherTarget.type === 'PipeExpression' && gatherTarget.streamEmit) {
        streamEmit = gatherTarget.streamEmit;
        // Keep the whole pipe as the target, but also expose streamEmit at gather level
      }
      
      return {
        type: 'ParallelExpression',
        location,
        branches,
        gatherPipe: {
          type: 'GatherPipe',
          location: this.currentLocation(),
          isPartial,
          target: gatherTarget,
          streamEmit
        }
      };
    }
    
    return first;
  }

  // Parse a chain of calls connected by |>, stopping before PP or gathering pipe
  private parsePipeChainForBranch(): AST.Expression {
    const location = this.currentLocation();
    const stages = [this.parseCallOrAtom()];
    
    // Chain of |> operators, but stop before the gathering pipe
    // We stop if the next token is |> or |?> and there's no PP after it
    while (this.check(TokenType.PIPE) && !this.check(TokenType.PIPE_PARTIAL)) {
      // Lookahead: if next is not PP, this might be the gathering pipe
      if (!this.isMoreBranchesAhead()) {
        break; // Don't consume this |>, it's the gathering pipe
      }
      
      this.advance(); // consume |>
      stages.push(this.parseCallOrAtom());
    }
    
    // Stream emit
    const streamEmit = this.tryParseStreamEmit();
    
    // Outcome matches not allowed in parallel branches - they're handled at the top level
    const outcomeMatches: AST.OutcomeMatch[] = [];
    
    // If only one stage, no stream emit, and no outcome matches, return the expression directly
    if (stages.length === 1 && !streamEmit && outcomeMatches.length === 0) {
      return stages[0];
    }
    
    return {
      type: 'PipeExpression',
      location,
      stages,
      streamEmit,
      outcomeMatches
    };
  }

  // Check if there are more PP branches ahead (used to distinguish branch |> from gathering |>)
  private isMoreBranchesAhead(): boolean {
    // Scan ahead to see if there's a PP token before EOF or other terminators
    let pos = this.current + 1; // Skip the |> we're currently looking at
    let depth = 0; // Track nesting level for parens/brackets
    
    while (pos < this.tokens.length) {
      const token = this.tokens[pos];
      
      if (token.type === TokenType.EOF) {
        return false;
      }
      
      if (token.type === TokenType.PP && depth === 0) {
        return true; // Found PP, so there are more branches
      }
      
      // Track nesting to avoid false positives
      if (token.type === TokenType.LPAREN || token.type === TokenType.LBRACKET || token.type === TokenType.LBRACE) {
        depth++;
      } else if (token.type === TokenType.RPAREN || token.type === TokenType.RBRACKET || token.type === TokenType.RBRACE) {
        depth--;
      }
      
      // If we hit outcome match or on handler at top level, no more branches
      if (depth === 0 && (token.type === TokenType.ON || (token.type === TokenType.BAR && pos + 1 < this.tokens.length && this.tokens[pos + 1].type === TokenType.DOT))) {
        return false;
      }
      
      pos++;
    }
    
    return false;
  }

  // Parse a chain of calls connected by |>
  private parsePipeChain(inBranch: boolean, parseOutcomeMatches: boolean = true): AST.Expression {
    if (inBranch) {
      return this.parsePipeChainForBranch();
    }
    
    const location = this.currentLocation();
    const stages = [this.parseCallOrAtom()];
    
    // Chain of |> operators
    while (this.match(TokenType.PIPE)) {
      stages.push(this.parseCallOrAtom());
    }
    
    // Stream emit
    const streamEmit = this.tryParseStreamEmit();
    
    // Outcome matches (| .name => expr)
    const outcomeMatches: AST.OutcomeMatch[] = [];
    if (parseOutcomeMatches) {
      while (this.check(TokenType.BAR) && this.peekNext()?.type === TokenType.DOT) {
        outcomeMatches.push(this.parseOutcomeMatch());
      }
    }
    
    // If only one stage, no stream emit, and no outcome matches, return the expression directly
    if (stages.length === 1 && !streamEmit && outcomeMatches.length === 0) {
      return stages[0];
    }
    
    return {
      type: 'PipeExpression',
      location,
      stages,
      streamEmit,
      outcomeMatches
    };
  }

  private parsePipeOrAtom(): AST.Expression {
    return this.parsePipeChain(false, true);
  }

  // Convert any expression to a PipeExpression (for use in parallel branches)
  private ensurePipeExpression(expr: AST.Expression, location: SourceLocation): AST.PipeExpression {
    if (expr.type === 'PipeExpression') {
      return expr as AST.PipeExpression;
    }
    
    return {
      type: 'PipeExpression',
      location,
      stages: [expr],
      streamEmit: null,
      outcomeMatches: []
    };
  }

  private parseCallOrAtom(): AST.Expression {
    const location = this.currentLocation();
    
    // If expression: if <cond> then <expr> else <expr>
    if (this.check(TokenType.IF)) {
      return this.parseIfExpression();
    }
    
    // Lambda: |:param, ...| => expr
    if (this.check(TokenType.BAR) && !this.checkNext(TokenType.DOT)) {
      return this.parseLambda();
    }
    
    // Tagged expression: ."tag" value  or  .name value
    if (this.check(TokenType.DOT)) {
      return this.parseTaggedExpression();
    }
    
    // Literals
    if (this.check(TokenType.NUMBER)) {
      return this.parseNumberLiteral();
    }
    if (this.check(TokenType.STRING)) {
      return this.parseStringLiteral();
    }
    if (this.check(TokenType.BOOLEAN)) {
      return this.parseBooleanLiteral();
    }
    if (this.check(TokenType.LBRACKET)) {
      return this.parseListLiteral();
    }
    
    // Type name for record literal: User { ... }
    if (this.check(TokenType.TYPE_NAME)) {
      return this.parseRecordLiteral();
    }
    
    // Identifier or call
    if (this.check(TokenType.IDENTIFIER)) {
      const name = this.advance().value;
      
      // Check for function call
      if (this.match(TokenType.LPAREN)) {
        const args: AST.Expression[] = [];
        
        if (!this.check(TokenType.RPAREN)) {
          args.push(this.parseExpression());
          while (this.match(TokenType.COMMA)) {
            args.push(this.parseExpression());
          }
        }
        
        this.consume(TokenType.RPAREN, 'Expected )');
        
        return {
          type: 'CallExpression',
          location,
          callee: name,
          args
        };
      }
      
      // Just an identifier
      return {
        type: 'Identifier',
        location,
        name
      };
    }
    
    this.error('Expected expression');
    throw new Error('Unreachable');
  }

  private parseTaggedExpression(): AST.TaggedExpression {
    const location = this.currentLocation();
    this.consume(TokenType.DOT, 'Expected .');
    let tag: AST.TagRef;
    if (this.check(TokenType.STRING)) {
      tag = { name: this.advance().value };
    } else if (this.check(TokenType.IDENTIFIER)) {
      tag = { name: this.advance().value };
    } else {
      this.error('Expected tag name (string literal or identifier after .)'); 
    }
    const value = this.parseCallOrAtom();
    return { type: 'TaggedExpression', location, tag, value };
  }

  private parseLambda(): AST.Lambda {
    const location = this.currentLocation();
    this.consume(TokenType.BAR, 'Expected |');
    
    const params: string[] = [];
    
    // Parse lambda parameters (:param)
    if (this.check(TokenType.COLON)) {
      this.advance();
      params.push(this.consume(TokenType.IDENTIFIER, 'Expected parameter name').value);
      
      while (this.match(TokenType.COMMA)) {
        this.consume(TokenType.COLON, 'Expected :');
        params.push(this.consume(TokenType.IDENTIFIER, 'Expected parameter name').value);
      }
    }
    
    this.consume(TokenType.BAR, 'Expected |');
    this.consume(TokenType.ARROW, 'Expected =>');
    
    // Lambda body: don't parse stream emits or outcome matches
    // (those belong to the containing expression)
    const body = this.parseCallOrAtom();
    
    return {
      type: 'Lambda',
      location,
      params,
      body
    };
  }

  private parseIfExpression(): AST.IfExpression {
    const location = this.currentLocation();
    this.consume(TokenType.IF, 'Expected if');
    
    // Parse condition (atom only, no pipes)
    const condition = this.parseCallOrAtom();
    
    // Expect then
    this.consume(TokenType.THEN, 'Expected then');
    
    // Parse then branch (can include pipes and stream emits)
    const thenBranch = this.parsePipeChain(false);
    
    // Expect else
    this.consume(TokenType.ELSE, 'Expected else');
    
    // Parse else branch (can include pipes and stream emits)
    const elseBranch = this.parsePipeChain(false);
    
    return {
      type: 'IfExpression',
      location,
      condition,
      thenBranch,
      elseBranch
    };
  }

  // ============================================================================
  // Literals
  // ============================================================================

  private parseNumberLiteral(): AST.NumberLiteral {
    const location = this.currentLocation();
    const token = this.consume(TokenType.NUMBER, 'Expected number');
    return {
      type: 'NumberLiteral',
      location,
      value: parseFloat(token.value)
    };
  }

  private parseStringLiteral(): AST.StringLiteral {
    const location = this.currentLocation();
    const token = this.consume(TokenType.STRING, 'Expected string');
    const hasInterpolation = token.value.includes('#{');
    return {
      type: 'StringLiteral',
      location,
      value: token.value,
      hasInterpolation
    };
  }

  private parseBooleanLiteral(): AST.BooleanLiteral {
    const location = this.currentLocation();
    const token = this.consume(TokenType.BOOLEAN, 'Expected boolean');
    return {
      type: 'BooleanLiteral',
      location,
      value: token.value === 'true'
    };
  }

  private parseListLiteral(): AST.ListLiteral {
    const location = this.currentLocation();
    this.consume(TokenType.LBRACKET, 'Expected [');
    
    const elements: AST.Expression[] = [];
    
    if (!this.check(TokenType.RBRACKET)) {
      elements.push(this.parseExpression());
      while (this.match(TokenType.COMMA)) {
        elements.push(this.parseExpression());
      }
    }
    
    this.consume(TokenType.RBRACKET, 'Expected ]');
    
    return {
      type: 'ListLiteral',
      location,
      elements
    };
  }

  private parseRecordLiteral(): AST.RecordLiteral {
    const location = this.currentLocation();
    const typeName = this.consume(TokenType.TYPE_NAME, 'Expected type name').value;
    
    this.consume(TokenType.LBRACE, 'Expected {');
    
    const fields: AST.RecordField[] = [];
    
    if (!this.check(TokenType.RBRACE)) {
      // field: value
      const name = this.consume(TokenType.IDENTIFIER, 'Expected field name').value;
      this.consume(TokenType.COLON, 'Expected :');
      const value = this.parseExpression();
      fields.push({ name, value });
      
      while (this.match(TokenType.COMMA)) {
        const name = this.consume(TokenType.IDENTIFIER, 'Expected field name').value;
        this.consume(TokenType.COLON, 'Expected :');
        const value = this.parseExpression();
        fields.push({ name, value });
      }
    }
    
    this.consume(TokenType.RBRACE, 'Expected }');
    
    return {
      type: 'RecordLiteral',
      location,
      typeName,
      fields
    };
  }

  // ============================================================================
  // Stream Operations
  // ============================================================================

  private tryParseStreamEmit(): AST.StreamEmit | null {
    if (!this.check(TokenType.AT) && !this.check(TokenType.AT_REDIRECT)) {
      return null;
    }
    
    const location = this.currentLocation();
    const isRedirect = this.match(TokenType.AT_REDIRECT);
    if (!isRedirect) {
      this.consume(TokenType.AT, 'Expected @');
    }
    
    const streams: AST.StreamRef[] = [];
    
    // Parse a single stream reference: "literal" or identifier (binding)
    const parseStreamRef = (): AST.StreamRef => {
      if (this.check(TokenType.STRING)) {
        return { name: this.advance().value, isDynamic: false };
      } else if (this.check(TokenType.IDENTIFIER)) {
        return { name: this.advance().value, isDynamic: true };
      } else {
        this.error('Expected stream name (string literal or binding identifier)');
      }
    };
    
    // @"stream", @binding, or @("s1", binding2, ...)
    if (this.match(TokenType.LPAREN)) {
      // Fan-out: multiple streams
      streams.push(parseStreamRef());
      while (this.match(TokenType.COMMA)) {
        streams.push(parseStreamRef());
      }
      this.consume(TokenType.RPAREN, 'Expected )');
    } else {
      // Single stream
      streams.push(parseStreamRef());
    }
    
    // Check for XX termination
    const terminates = this.match(TokenType.XX);
    
    return {
      type: 'StreamEmit',
      location,
      isRedirect,
      streams,
      terminates
    };
  }

  private parseOutcomeMatch(): AST.OutcomeMatch {
    const location = this.currentLocation();
    this.consume(TokenType.BAR, 'Expected |');
    this.consume(TokenType.DOT, 'Expected .');
    let tag: AST.TagRef;
    if (this.check(TokenType.STRING)) {
      tag = { name: this.advance().value };
    } else if (this.check(TokenType.IDENTIFIER)) {
      tag = { name: this.advance().value };
    } else {
      this.error('Expected tag name (string literal or identifier after .)');
    }
    this.consume(TokenType.ARROW, 'Expected =>');
    
    // Handler can be:
    // 1. Just a stream emit: | .fail => @"errors"
    // 2. An expression followed by optional stream emit: | .fail => log() @"errors"
    let handler: AST.Expression;
    let streamEmit: AST.StreamEmit | null = null;
    
    if (this.check(TokenType.AT) || this.check(TokenType.AT_REDIRECT)) {
      // Just a stream emit - create a placeholder identifier for the implicit value
      streamEmit = this.tryParseStreamEmit();
      // Use a special identifier to represent "the current value"
      handler = {
        type: 'Identifier',
        location: this.currentLocation(),
        name: '__outcome_value__'
      };
    } else {
      handler = this.parseExpression(false); // Don't parse outcome matches in handler
      streamEmit = this.tryParseStreamEmit();
    }
    
    return {
      type: 'OutcomeMatch',
      location,
      tag,
      handler,
      streamEmit
    };
  }

  // ============================================================================
  // Contingencies
  // ============================================================================

  private parseOnHandler(): AST.OnHandler {
    const location = this.currentLocation();
    this.consume(TokenType.ON, 'Expected on');
    
    // Stream pattern: @"pattern"
    this.consume(TokenType.AT, 'Expected @');
    const streamPattern = this.consume(TokenType.STRING, 'Expected stream pattern').value;
    
    this.consume(TokenType.PIPE, 'Expected |>');
    
    const handler = this.parseLambda();
    const streamEmit = this.tryParseStreamEmit();
    
    return {
      type: 'OnHandler',
      location,
      streamPattern,
      handler,
      streamEmit
    };
  }

  private parseRouteDeclaration(): AST.RouteDeclaration {
    const location = this.currentLocation();
    this.consume(TokenType.ROUTE, 'Expected route');
    
    // Stream pattern: @"pattern" or @ binding
    this.consume(TokenType.AT, 'Expected @');
    let streamPattern: AST.StreamRef;
    if (this.check(TokenType.STRING)) {
      streamPattern = { name: this.advance().value, isDynamic: false };
    } else if (this.check(TokenType.IDENTIFIER)) {
      streamPattern = { name: this.advance().value, isDynamic: true };
    } else {
      this.error('Expected stream pattern (string literal or binding identifier)');
    }
    
    // Expect |> followed by pipeline
    this.consume(TokenType.PIPE, 'Expected |>');
    
    // Parse the pipeline — a chain of function calls/expressions
    const pipeline = this.parsePipeChain(false, false);
    
    return {
      type: 'RouteDeclaration',
      location,
      streamPattern,
      pipeline
    };
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private checkIdentifier(value: string): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    return token.type === TokenType.IDENTIFIER && token.value === value;
  }

  private checkNext(type: TokenType): boolean {
    const next = this.peekNext();
    return next !== null && next.type === type;
  }

  private checkAhead(type: TokenType, distance: number): boolean {
    if (this.current + distance >= this.tokens.length) return false;
    return this.tokens[this.current + distance].type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private peekNext(): Token | null {
    if (this.current + 1 >= this.tokens.length) return null;
    return this.tokens[this.current + 1];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    
    const token = this.peek();
    throw new Error(
      `[stroum] error at line ${token.line}, col ${token.column}: ${message} (got ${token.type})`
    );
  }

  private error(message: string): never {
    const token = this.peek();
    throw new Error(
      `[stroum] error at line ${token.line}, col ${token.column}: ${message}`
    );
  }

  private currentLocation(): SourceLocation {
    const token = this.peek();
    return { line: token.line, column: token.column };
  }
}
