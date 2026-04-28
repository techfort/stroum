"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const types_1 = require("./types");
class Parser {
    constructor(tokens) {
        this.current = 0;
        this.tokens = tokens;
    }
    parse() {
        const location = this.currentLocation();
        const imports = [];
        const definitions = [];
        const contingencies = [];
        const primaryExpressions = [];
        // Parse imports (must come first)
        while (!this.isAtEnd() && this.check(types_1.TokenType.SIGIL_IMPORT)) {
            imports.push(this.parseImport());
        }
        // Parse definitions (structs, functions, bindings)
        while (!this.isAtEnd() && this.isDefinition()) {
            definitions.push(this.parseDefinition());
        }
        // Parse primary expressions (multiple statements allowed)
        while (!this.isAtEnd() && !this.check(types_1.TokenType.ON) && !this.check(types_1.TokenType.ROUTE)) {
            primaryExpressions.push(this.parseExpression());
        }
        // Parse contingencies (on handlers and outcome matches at module level)
        while (!this.isAtEnd()) {
            if (this.check(types_1.TokenType.ON)) {
                contingencies.push(this.parseOnHandler());
            }
            else if (this.check(types_1.TokenType.ROUTE)) {
                contingencies.push(this.parseRouteDeclaration());
            }
            else if (this.check(types_1.TokenType.BAR)) {
                contingencies.push(this.parseOutcomeMatch());
            }
            else {
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
    parseImport() {
        const location = this.currentLocation();
        this.consume(types_1.TokenType.SIGIL_IMPORT, 'Expected i:');
        // Module path can be identifier (core, math) or string literal ("./utils.stm")
        let modulePath;
        if (this.check(types_1.TokenType.STRING)) {
            modulePath = this.advance().value;
        }
        else if (this.check(types_1.TokenType.IDENTIFIER)) {
            modulePath = this.advance().value;
        }
        else {
            this.error('Expected module name or file path after i:');
            modulePath = '';
        }
        // Optional selective imports: add, mul, print (comma-separated)
        let imports = null;
        if (this.check(types_1.TokenType.IDENTIFIER) && !this.checkIdentifier('as')) {
            imports = [];
            imports.push(this.advance().value);
            while (this.match(types_1.TokenType.COMMA)) {
                if (this.check(types_1.TokenType.IDENTIFIER)) {
                    imports.push(this.advance().value);
                }
                else {
                    this.error('Expected function name after comma in import list');
                }
            }
        }
        // Optional alias: as identifier
        let alias = null;
        if (this.checkIdentifier('as')) {
            this.advance(); // consume 'as'
            alias = this.consume(types_1.TokenType.IDENTIFIER, 'Expected alias name after "as"').value;
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
    isDefinition() {
        return (this.check(types_1.TokenType.SIGIL_STRUCT) ||
            this.check(types_1.TokenType.SIGIL_FUNCTION) ||
            this.check(types_1.TokenType.REC) ||
            this.check(types_1.TokenType.SIGIL_BINDING) ||
            this.check(types_1.TokenType.COLON));
    }
    parseDefinition() {
        if (this.check(types_1.TokenType.SIGIL_STRUCT)) {
            return this.parseStructDeclaration();
        }
        else if (this.check(types_1.TokenType.SIGIL_FUNCTION) || this.check(types_1.TokenType.REC)) {
            return this.parseFunctionDeclaration();
        }
        else {
            return this.parseBindingDeclaration();
        }
    }
    parseStructDeclaration() {
        const location = this.currentLocation();
        this.consume(types_1.TokenType.SIGIL_STRUCT, 'Expected s:');
        const nameToken = this.consume(types_1.TokenType.TYPE_NAME, 'Expected type name');
        const name = nameToken.value;
        this.consume(types_1.TokenType.LBRACE, 'Expected {');
        const fields = [];
        // Handle indentation
        if (this.match(types_1.TokenType.INDENT)) {
            while (!this.check(types_1.TokenType.DEDENT) && !this.isAtEnd()) {
                const fieldName = this.consume(types_1.TokenType.IDENTIFIER, 'Expected field name').value;
                this.consume(types_1.TokenType.COLON, 'Expected :');
                const typeName = this.consume(types_1.TokenType.TYPE_NAME, 'Expected type name').value;
                fields.push({ name: fieldName, typeName });
            }
            this.consume(types_1.TokenType.DEDENT, 'Expected dedent');
        }
        this.consume(types_1.TokenType.RBRACE, 'Expected }');
        return {
            type: 'StructDeclaration',
            location,
            name,
            fields
        };
    }
    parseFunctionDeclaration() {
        const location = this.currentLocation();
        const isRecursive = this.match(types_1.TokenType.REC);
        this.consume(types_1.TokenType.SIGIL_FUNCTION, 'Expected f:');
        const name = this.consume(types_1.TokenType.IDENTIFIER, 'Expected function name').value;
        // Parse parameters (space-separated identifiers before =>)
        const params = [];
        while (!this.check(types_1.TokenType.ARROW) && !this.check(types_1.TokenType.EMIT_CONTRACT) && !this.isAtEnd()) {
            if (this.check(types_1.TokenType.IDENTIFIER)) {
                params.push(this.advance().value);
            }
            else {
                break;
            }
        }
        // Parse emission contract (~> @"stream", ...)
        let emissionContract = null;
        if (this.match(types_1.TokenType.EMIT_CONTRACT)) {
            emissionContract = [];
            // Expect @"stream"
            this.consume(types_1.TokenType.AT, 'Expected @ after ~>');
            emissionContract.push(this.consume(types_1.TokenType.STRING, 'Expected stream name').value);
            // Additional streams separated by commas
            while (this.match(types_1.TokenType.COMMA)) {
                this.consume(types_1.TokenType.AT, 'Expected @');
                emissionContract.push(this.consume(types_1.TokenType.STRING, 'Expected stream name').value);
            }
        }
        this.consume(types_1.TokenType.ARROW, 'Expected =>');
        // Parse body (can be single expression or indented body)
        let body;
        if (this.check(types_1.TokenType.INDENT)) {
            body = this.parseIndentedBody();
        }
        else {
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
    parseBindingDeclaration() {
        const location = this.currentLocation();
        const hasExplicitSigil = this.match(types_1.TokenType.SIGIL_BINDING);
        this.consume(types_1.TokenType.COLON, 'Expected :');
        const name = this.consume(types_1.TokenType.IDENTIFIER, 'Expected binding name').value;
        const value = this.parseExpression();
        return {
            type: 'BindingDeclaration',
            location,
            name,
            value,
            hasExplicitSigil
        };
    }
    parseIndentedBody() {
        const location = this.currentLocation();
        this.consume(types_1.TokenType.INDENT, 'Expected indent');
        const statements = [];
        while (!this.check(types_1.TokenType.DEDENT) && !this.isAtEnd()) {
            if (this.check(types_1.TokenType.COLON) || this.check(types_1.TokenType.SIGIL_BINDING)) {
                statements.push(this.parseBindingDeclaration());
            }
            else {
                statements.push(this.parseExpression());
            }
        }
        this.consume(types_1.TokenType.DEDENT, 'Expected dedent');
        return {
            type: 'IndentedBody',
            location,
            statements
        };
    }
    // ============================================================================
    // Expressions
    // ============================================================================
    parseExpression(parseOutcomeMatches = true) {
        return this.parseParallelOrPipe(parseOutcomeMatches);
    }
    parseParallelOrPipe(parseOutcomeMatches = true) {
        const location = this.currentLocation();
        // Parse first branch/expression
        const first = this.parsePipeChain(false, parseOutcomeMatches);
        // Check for PP (parallel composition)
        if (this.check(types_1.TokenType.PP)) {
            const branches = [this.ensurePipeExpression(first, location)];
            // Collect all PP branches  
            while (this.match(types_1.TokenType.PP)) {
                // When parsing branches, stop before the gathering pipe
                const branch = this.parsePipeChainForBranch();
                branches.push(this.ensurePipeExpression(branch, this.currentLocation()));
            }
            // Gathering pipe (|> or |?>)
            const isPartial = this.match(types_1.TokenType.PIPE_PARTIAL);
            if (!isPartial) {
                this.consume(types_1.TokenType.PIPE, 'Expected |> or |?> after PP');
            }
            // Parse the gathering pipeline (might be a chain)
            const gatherTarget = this.parsePipeChain(false, parseOutcomeMatches);
            // Extract stream emit if the target is a PipeExpression
            let streamEmit = null;
            let finalTarget = gatherTarget;
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
    parsePipeChainForBranch() {
        const location = this.currentLocation();
        const stages = [this.parseCallOrAtom()];
        // Chain of |> operators, but stop before the gathering pipe
        // We stop if the next token is |> or |?> and there's no PP after it
        while (this.check(types_1.TokenType.PIPE) && !this.check(types_1.TokenType.PIPE_PARTIAL)) {
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
        const outcomeMatches = [];
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
    isMoreBranchesAhead() {
        // Scan ahead to see if there's a PP token before EOF or other terminators
        let pos = this.current + 1; // Skip the |> we're currently looking at
        let depth = 0; // Track nesting level for parens/brackets
        while (pos < this.tokens.length) {
            const token = this.tokens[pos];
            if (token.type === types_1.TokenType.EOF) {
                return false;
            }
            if (token.type === types_1.TokenType.PP && depth === 0) {
                return true; // Found PP, so there are more branches
            }
            // Track nesting to avoid false positives
            if (token.type === types_1.TokenType.LPAREN || token.type === types_1.TokenType.LBRACKET || token.type === types_1.TokenType.LBRACE) {
                depth++;
            }
            else if (token.type === types_1.TokenType.RPAREN || token.type === types_1.TokenType.RBRACKET || token.type === types_1.TokenType.RBRACE) {
                depth--;
            }
            // If we hit outcome match or on handler at top level, no more branches
            if (depth === 0 && (token.type === types_1.TokenType.ON || (token.type === types_1.TokenType.BAR && pos + 1 < this.tokens.length && this.tokens[pos + 1].type === types_1.TokenType.DOT))) {
                return false;
            }
            pos++;
        }
        return false;
    }
    // Parse a chain of calls connected by |>
    parsePipeChain(inBranch, parseOutcomeMatches = true) {
        if (inBranch) {
            return this.parsePipeChainForBranch();
        }
        const location = this.currentLocation();
        const stages = [this.parseCallOrAtom()];
        // Chain of |> operators
        while (this.match(types_1.TokenType.PIPE)) {
            stages.push(this.parseCallOrAtom());
        }
        // Stream emit
        const streamEmit = this.tryParseStreamEmit();
        // Outcome matches (| .name => expr)
        const outcomeMatches = [];
        if (parseOutcomeMatches) {
            while (this.check(types_1.TokenType.BAR) && this.peekNext()?.type === types_1.TokenType.DOT) {
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
    parsePipeOrAtom() {
        return this.parsePipeChain(false, true);
    }
    // Convert any expression to a PipeExpression (for use in parallel branches)
    ensurePipeExpression(expr, location) {
        if (expr.type === 'PipeExpression') {
            return expr;
        }
        return {
            type: 'PipeExpression',
            location,
            stages: [expr],
            streamEmit: null,
            outcomeMatches: []
        };
    }
    parseCallOrAtom() {
        const location = this.currentLocation();
        // If expression: if <cond> then <expr> else <expr>
        if (this.check(types_1.TokenType.IF)) {
            return this.parseIfExpression();
        }
        // Lambda: |:param, ...| => expr
        if (this.check(types_1.TokenType.BAR) && !this.checkNext(types_1.TokenType.DOT)) {
            return this.parseLambda();
        }
        // Tagged expression: ."tag" value  or  .name value
        if (this.check(types_1.TokenType.DOT)) {
            return this.parseTaggedExpression();
        }
        // Literals
        if (this.check(types_1.TokenType.NUMBER)) {
            return this.parseNumberLiteral();
        }
        if (this.check(types_1.TokenType.STRING)) {
            return this.parseStringLiteral();
        }
        if (this.check(types_1.TokenType.BOOLEAN)) {
            return this.parseBooleanLiteral();
        }
        if (this.check(types_1.TokenType.LBRACKET)) {
            return this.parseListLiteral();
        }
        // Type name for record literal: User { ... }
        if (this.check(types_1.TokenType.TYPE_NAME)) {
            return this.parseRecordLiteral();
        }
        // Identifier or call
        if (this.check(types_1.TokenType.IDENTIFIER)) {
            const name = this.advance().value;
            // Check for function call
            if (this.match(types_1.TokenType.LPAREN)) {
                const args = [];
                if (!this.check(types_1.TokenType.RPAREN)) {
                    args.push(this.parseExpression());
                    while (this.match(types_1.TokenType.COMMA)) {
                        args.push(this.parseExpression());
                    }
                }
                this.consume(types_1.TokenType.RPAREN, 'Expected )');
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
    parseTaggedExpression() {
        const location = this.currentLocation();
        this.consume(types_1.TokenType.DOT, 'Expected .');
        let tag;
        if (this.check(types_1.TokenType.STRING)) {
            tag = { name: this.advance().value };
        }
        else if (this.check(types_1.TokenType.IDENTIFIER)) {
            tag = { name: this.advance().value };
        }
        else {
            this.error('Expected tag name (string literal or identifier after .)');
        }
        const value = this.parseCallOrAtom();
        return { type: 'TaggedExpression', location, tag, value };
    }
    parseLambda() {
        const location = this.currentLocation();
        this.consume(types_1.TokenType.BAR, 'Expected |');
        const params = [];
        // Parse lambda parameters (:param)
        if (this.check(types_1.TokenType.COLON)) {
            this.advance();
            params.push(this.consume(types_1.TokenType.IDENTIFIER, 'Expected parameter name').value);
            while (this.match(types_1.TokenType.COMMA)) {
                this.consume(types_1.TokenType.COLON, 'Expected :');
                params.push(this.consume(types_1.TokenType.IDENTIFIER, 'Expected parameter name').value);
            }
        }
        this.consume(types_1.TokenType.BAR, 'Expected |');
        this.consume(types_1.TokenType.ARROW, 'Expected =>');
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
    parseIfExpression() {
        const location = this.currentLocation();
        this.consume(types_1.TokenType.IF, 'Expected if');
        // Parse condition (atom only, no pipes)
        const condition = this.parseCallOrAtom();
        // Expect then
        this.consume(types_1.TokenType.THEN, 'Expected then');
        // Parse then branch (can include pipes and stream emits)
        const thenBranch = this.parsePipeChain(false);
        // Expect else
        this.consume(types_1.TokenType.ELSE, 'Expected else');
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
    parseNumberLiteral() {
        const location = this.currentLocation();
        const token = this.consume(types_1.TokenType.NUMBER, 'Expected number');
        return {
            type: 'NumberLiteral',
            location,
            value: parseFloat(token.value)
        };
    }
    parseStringLiteral() {
        const location = this.currentLocation();
        const token = this.consume(types_1.TokenType.STRING, 'Expected string');
        const hasInterpolation = token.value.includes('#{');
        return {
            type: 'StringLiteral',
            location,
            value: token.value,
            hasInterpolation
        };
    }
    parseBooleanLiteral() {
        const location = this.currentLocation();
        const token = this.consume(types_1.TokenType.BOOLEAN, 'Expected boolean');
        return {
            type: 'BooleanLiteral',
            location,
            value: token.value === 'true'
        };
    }
    parseListLiteral() {
        const location = this.currentLocation();
        this.consume(types_1.TokenType.LBRACKET, 'Expected [');
        const elements = [];
        if (!this.check(types_1.TokenType.RBRACKET)) {
            elements.push(this.parseExpression());
            while (this.match(types_1.TokenType.COMMA)) {
                elements.push(this.parseExpression());
            }
        }
        this.consume(types_1.TokenType.RBRACKET, 'Expected ]');
        return {
            type: 'ListLiteral',
            location,
            elements
        };
    }
    parseRecordLiteral() {
        const location = this.currentLocation();
        const typeName = this.consume(types_1.TokenType.TYPE_NAME, 'Expected type name').value;
        this.consume(types_1.TokenType.LBRACE, 'Expected {');
        const fields = [];
        if (!this.check(types_1.TokenType.RBRACE)) {
            // field: value
            const name = this.consume(types_1.TokenType.IDENTIFIER, 'Expected field name').value;
            this.consume(types_1.TokenType.COLON, 'Expected :');
            const value = this.parseExpression();
            fields.push({ name, value });
            while (this.match(types_1.TokenType.COMMA)) {
                const name = this.consume(types_1.TokenType.IDENTIFIER, 'Expected field name').value;
                this.consume(types_1.TokenType.COLON, 'Expected :');
                const value = this.parseExpression();
                fields.push({ name, value });
            }
        }
        this.consume(types_1.TokenType.RBRACE, 'Expected }');
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
    tryParseStreamEmit() {
        if (!this.check(types_1.TokenType.AT) && !this.check(types_1.TokenType.AT_REDIRECT)) {
            return null;
        }
        const location = this.currentLocation();
        const isRedirect = this.match(types_1.TokenType.AT_REDIRECT);
        if (!isRedirect) {
            this.consume(types_1.TokenType.AT, 'Expected @');
        }
        const streams = [];
        // Parse a single stream reference: "literal" or identifier (binding)
        const parseStreamRef = () => {
            if (this.check(types_1.TokenType.STRING)) {
                return { name: this.advance().value, isDynamic: false };
            }
            else if (this.check(types_1.TokenType.IDENTIFIER)) {
                return { name: this.advance().value, isDynamic: true };
            }
            else {
                this.error('Expected stream name (string literal or binding identifier)');
            }
        };
        // @"stream", @binding, or @("s1", binding2, ...)
        if (this.match(types_1.TokenType.LPAREN)) {
            // Fan-out: multiple streams
            streams.push(parseStreamRef());
            while (this.match(types_1.TokenType.COMMA)) {
                streams.push(parseStreamRef());
            }
            this.consume(types_1.TokenType.RPAREN, 'Expected )');
        }
        else {
            // Single stream
            streams.push(parseStreamRef());
        }
        // Check for XX termination
        const terminates = this.match(types_1.TokenType.XX);
        return {
            type: 'StreamEmit',
            location,
            isRedirect,
            streams,
            terminates
        };
    }
    parseOutcomeMatch() {
        const location = this.currentLocation();
        this.consume(types_1.TokenType.BAR, 'Expected |');
        this.consume(types_1.TokenType.DOT, 'Expected .');
        let tag;
        if (this.check(types_1.TokenType.STRING)) {
            tag = { name: this.advance().value };
        }
        else if (this.check(types_1.TokenType.IDENTIFIER)) {
            tag = { name: this.advance().value };
        }
        else {
            this.error('Expected tag name (string literal or identifier after .)');
        }
        this.consume(types_1.TokenType.ARROW, 'Expected =>');
        // Handler can be:
        // 1. Just a stream emit: | .fail => @"errors"
        // 2. An expression followed by optional stream emit: | .fail => log() @"errors"
        let handler;
        let streamEmit = null;
        if (this.check(types_1.TokenType.AT) || this.check(types_1.TokenType.AT_REDIRECT)) {
            // Just a stream emit - create a placeholder identifier for the implicit value
            streamEmit = this.tryParseStreamEmit();
            // Use a special identifier to represent "the current value"
            handler = {
                type: 'Identifier',
                location: this.currentLocation(),
                name: '__outcome_value__'
            };
        }
        else {
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
    parseOnHandler() {
        const location = this.currentLocation();
        this.consume(types_1.TokenType.ON, 'Expected on');
        // Stream pattern: @"pattern"
        this.consume(types_1.TokenType.AT, 'Expected @');
        const streamPattern = this.consume(types_1.TokenType.STRING, 'Expected stream pattern').value;
        this.consume(types_1.TokenType.PIPE, 'Expected |>');
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
    parseRouteDeclaration() {
        const location = this.currentLocation();
        this.consume(types_1.TokenType.ROUTE, 'Expected route');
        // Stream pattern: @"pattern" or @ binding
        this.consume(types_1.TokenType.AT, 'Expected @');
        let streamPattern;
        if (this.check(types_1.TokenType.STRING)) {
            streamPattern = { name: this.advance().value, isDynamic: false };
        }
        else if (this.check(types_1.TokenType.IDENTIFIER)) {
            streamPattern = { name: this.advance().value, isDynamic: true };
        }
        else {
            this.error('Expected stream pattern (string literal or binding identifier)');
        }
        // Expect |> followed by pipeline
        this.consume(types_1.TokenType.PIPE, 'Expected |>');
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
    match(type) {
        if (this.check(type)) {
            this.advance();
            return true;
        }
        return false;
    }
    check(type) {
        if (this.isAtEnd())
            return false;
        return this.peek().type === type;
    }
    checkIdentifier(value) {
        if (this.isAtEnd())
            return false;
        const token = this.peek();
        return token.type === types_1.TokenType.IDENTIFIER && token.value === value;
    }
    checkNext(type) {
        const next = this.peekNext();
        return next !== null && next.type === type;
    }
    checkAhead(type, distance) {
        if (this.current + distance >= this.tokens.length)
            return false;
        return this.tokens[this.current + distance].type === type;
    }
    advance() {
        if (!this.isAtEnd())
            this.current++;
        return this.previous();
    }
    isAtEnd() {
        return this.peek().type === types_1.TokenType.EOF;
    }
    peek() {
        return this.tokens[this.current];
    }
    peekNext() {
        if (this.current + 1 >= this.tokens.length)
            return null;
        return this.tokens[this.current + 1];
    }
    previous() {
        return this.tokens[this.current - 1];
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        const token = this.peek();
        throw new Error(`[stroum] error at line ${token.line}, col ${token.column}: ${message} (got ${token.type})`);
    }
    error(message) {
        const token = this.peek();
        throw new Error(`[stroum] error at line ${token.line}, col ${token.column}: ${message}`);
    }
    currentLocation() {
        const token = this.peek();
        return { line: token.line, column: token.column };
    }
}
exports.Parser = Parser;
//# sourceMappingURL=parser.js.map