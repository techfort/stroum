"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
var types_1 = require("./types");
var Parser = /** @class */ (function () {
    function Parser(tokens) {
        this.current = 0;
        this.tokens = tokens;
    }
    Parser.prototype.parse = function () {
        var location = this.currentLocation();
        var imports = [];
        var definitions = [];
        var contingencies = [];
        var primaryExpression = null;
        // Parse imports (must come first)
        while (!this.isAtEnd() && this.check(types_1.TokenType.SIGIL_IMPORT)) {
            imports.push(this.parseImport());
        }
        // Parse definitions (structs, functions, bindings)
        while (!this.isAtEnd() && this.isDefinition()) {
            definitions.push(this.parseDefinition());
        }
        // Parse primary expression (singular)
        if (!this.isAtEnd() && !this.check(types_1.TokenType.ON)) {
            primaryExpression = this.parseExpression();
        }
        // Parse contingencies (on handlers and outcome matches at module level)
        while (!this.isAtEnd()) {
            if (this.check(types_1.TokenType.ON)) {
                contingencies.push(this.parseOnHandler());
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
            location: location,
            imports: imports,
            definitions: definitions,
            primaryExpression: primaryExpression,
            contingencies: contingencies
        };
    };
    // ============================================================================
    // Imports
    // ============================================================================
    Parser.prototype.parseImport = function () {
        var location = this.currentLocation();
        this.consume(types_1.TokenType.SIGIL_IMPORT, 'Expected i:');
        // Module path can be identifier (core, math) or string literal ("./utils.stm")
        var modulePath;
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
        var imports = null;
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
        var alias = null;
        if (this.checkIdentifier('as')) {
            this.advance(); // consume 'as'
            alias = this.consume(types_1.TokenType.IDENTIFIER, 'Expected alias name after "as"').value;
        }
        return {
            type: 'ImportDeclaration',
            location: location,
            modulePath: modulePath,
            imports: imports,
            alias: alias
        };
    };
    // ============================================================================
    // Definitions
    // ============================================================================
    Parser.prototype.isDefinition = function () {
        return (this.check(types_1.TokenType.SIGIL_STRUCT) ||
            this.check(types_1.TokenType.SIGIL_FUNCTION) ||
            this.check(types_1.TokenType.REC) ||
            this.check(types_1.TokenType.SIGIL_BINDING) ||
            this.check(types_1.TokenType.COLON));
    };
    Parser.prototype.parseDefinition = function () {
        if (this.check(types_1.TokenType.SIGIL_STRUCT)) {
            return this.parseStructDeclaration();
        }
        else if (this.check(types_1.TokenType.SIGIL_FUNCTION) || this.check(types_1.TokenType.REC)) {
            return this.parseFunctionDeclaration();
        }
        else {
            return this.parseBindingDeclaration();
        }
    };
    Parser.prototype.parseStructDeclaration = function () {
        var location = this.currentLocation();
        this.consume(types_1.TokenType.SIGIL_STRUCT, 'Expected s:');
        var nameToken = this.consume(types_1.TokenType.TYPE_NAME, 'Expected type name');
        var name = nameToken.value;
        this.consume(types_1.TokenType.LBRACE, 'Expected {');
        var fields = [];
        // Handle indentation
        if (this.match(types_1.TokenType.INDENT)) {
            while (!this.check(types_1.TokenType.DEDENT) && !this.isAtEnd()) {
                var fieldName = this.consume(types_1.TokenType.IDENTIFIER, 'Expected field name').value;
                this.consume(types_1.TokenType.COLON, 'Expected :');
                var typeName = this.consume(types_1.TokenType.TYPE_NAME, 'Expected type name').value;
                fields.push({ name: fieldName, typeName: typeName });
            }
            this.consume(types_1.TokenType.DEDENT, 'Expected dedent');
        }
        this.consume(types_1.TokenType.RBRACE, 'Expected }');
        return {
            type: 'StructDeclaration',
            location: location,
            name: name,
            fields: fields
        };
    };
    Parser.prototype.parseFunctionDeclaration = function () {
        var location = this.currentLocation();
        var isRecursive = this.match(types_1.TokenType.REC);
        this.consume(types_1.TokenType.SIGIL_FUNCTION, 'Expected f:');
        var name = this.consume(types_1.TokenType.IDENTIFIER, 'Expected function name').value;
        // Parse parameters (space-separated identifiers before =>)
        var params = [];
        while (!this.check(types_1.TokenType.ARROW) && !this.check(types_1.TokenType.EMIT_CONTRACT) && !this.isAtEnd()) {
            if (this.check(types_1.TokenType.IDENTIFIER)) {
                params.push(this.advance().value);
            }
            else {
                break;
            }
        }
        // Parse emission contract (~> @"stream", ...)
        var emissionContract = null;
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
        var body;
        if (this.check(types_1.TokenType.INDENT)) {
            body = this.parseIndentedBody();
        }
        else {
            body = this.parseExpression();
        }
        return {
            type: 'FunctionDeclaration',
            location: location,
            isRecursive: isRecursive,
            name: name,
            params: params,
            emissionContract: emissionContract,
            body: body
        };
    };
    Parser.prototype.parseBindingDeclaration = function () {
        var location = this.currentLocation();
        var hasExplicitSigil = this.match(types_1.TokenType.SIGIL_BINDING);
        this.consume(types_1.TokenType.COLON, 'Expected :');
        var name = this.consume(types_1.TokenType.IDENTIFIER, 'Expected binding name').value;
        var value = this.parseExpression();
        return {
            type: 'BindingDeclaration',
            location: location,
            name: name,
            value: value,
            hasExplicitSigil: hasExplicitSigil
        };
    };
    Parser.prototype.parseIndentedBody = function () {
        var location = this.currentLocation();
        this.consume(types_1.TokenType.INDENT, 'Expected indent');
        var statements = [];
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
            location: location,
            statements: statements
        };
    };
    // ============================================================================
    // Expressions
    // ============================================================================
    Parser.prototype.parseExpression = function (parseOutcomeMatches) {
        if (parseOutcomeMatches === void 0) { parseOutcomeMatches = true; }
        return this.parseParallelOrPipe(parseOutcomeMatches);
    };
    Parser.prototype.parseParallelOrPipe = function (parseOutcomeMatches) {
        if (parseOutcomeMatches === void 0) { parseOutcomeMatches = true; }
        var location = this.currentLocation();
        // Parse first branch/expression
        var first = this.parsePipeChain(false, parseOutcomeMatches);
        // Check for PP (parallel composition)
        if (this.check(types_1.TokenType.PP)) {
            var branches = [this.ensurePipeExpression(first, location)];
            // Collect all PP branches  
            while (this.match(types_1.TokenType.PP)) {
                // When parsing branches, stop before the gathering pipe
                var branch = this.parsePipeChainForBranch();
                branches.push(this.ensurePipeExpression(branch, this.currentLocation()));
            }
            // Gathering pipe (|> or |?>)
            var isPartial = this.match(types_1.TokenType.PIPE_PARTIAL);
            if (!isPartial) {
                this.consume(types_1.TokenType.PIPE, 'Expected |> or |?> after PP');
            }
            // Parse the gathering pipeline (might be a chain)
            var gatherTarget = this.parsePipeChain(false, parseOutcomeMatches);
            // Extract stream emit if the target is a PipeExpression
            var streamEmit = null;
            var finalTarget = gatherTarget;
            if (gatherTarget.type === 'PipeExpression' && gatherTarget.streamEmit) {
                streamEmit = gatherTarget.streamEmit;
                // Keep the whole pipe as the target, but also expose streamEmit at gather level
            }
            return {
                type: 'ParallelExpression',
                location: location,
                branches: branches,
                gatherPipe: {
                    type: 'GatherPipe',
                    location: this.currentLocation(),
                    isPartial: isPartial,
                    target: gatherTarget,
                    streamEmit: streamEmit
                }
            };
        }
        return first;
    };
    // Parse a chain of calls connected by |>, stopping before PP or gathering pipe
    Parser.prototype.parsePipeChainForBranch = function () {
        var location = this.currentLocation();
        var stages = [this.parseCallOrAtom()];
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
        var streamEmit = this.tryParseStreamEmit();
        // Outcome matches not allowed in parallel branches - they're handled at the top level
        var outcomeMatches = [];
        // If only one stage, no stream emit, and no outcome matches, return the expression directly
        if (stages.length === 1 && !streamEmit && outcomeMatches.length === 0) {
            return stages[0];
        }
        return {
            type: 'PipeExpression',
            location: location,
            stages: stages,
            streamEmit: streamEmit,
            outcomeMatches: outcomeMatches
        };
    };
    // Check if there are more PP branches ahead (used to distinguish branch |> from gathering |>)
    Parser.prototype.isMoreBranchesAhead = function () {
        // Scan ahead to see if there's a PP token before EOF or other terminators
        var pos = this.current + 1; // Skip the |> we're currently looking at
        var depth = 0; // Track nesting level for parens/brackets
        while (pos < this.tokens.length) {
            var token = this.tokens[pos];
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
    };
    // Parse a chain of calls connected by |>
    Parser.prototype.parsePipeChain = function (inBranch, parseOutcomeMatches) {
        var _a;
        if (parseOutcomeMatches === void 0) { parseOutcomeMatches = true; }
        if (inBranch) {
            return this.parsePipeChainForBranch();
        }
        var location = this.currentLocation();
        var stages = [this.parseCallOrAtom()];
        // Chain of |> operators
        while (this.match(types_1.TokenType.PIPE)) {
            stages.push(this.parseCallOrAtom());
        }
        // Stream emit
        var streamEmit = this.tryParseStreamEmit();
        // Outcome matches (| .name => expr)
        var outcomeMatches = [];
        if (parseOutcomeMatches) {
            while (this.check(types_1.TokenType.BAR) && ((_a = this.peekNext()) === null || _a === void 0 ? void 0 : _a.type) === types_1.TokenType.DOT) {
                outcomeMatches.push(this.parseOutcomeMatch());
            }
        }
        // If only one stage, no stream emit, and no outcome matches, return the expression directly
        if (stages.length === 1 && !streamEmit && outcomeMatches.length === 0) {
            return stages[0];
        }
        return {
            type: 'PipeExpression',
            location: location,
            stages: stages,
            streamEmit: streamEmit,
            outcomeMatches: outcomeMatches
        };
    };
    Parser.prototype.parsePipeOrAtom = function () {
        return this.parsePipeChain(false, true);
    };
    // Convert any expression to a PipeExpression (for use in parallel branches)
    Parser.prototype.ensurePipeExpression = function (expr, location) {
        if (expr.type === 'PipeExpression') {
            return expr;
        }
        return {
            type: 'PipeExpression',
            location: location,
            stages: [expr],
            streamEmit: null,
            outcomeMatches: []
        };
    };
    Parser.prototype.parseCallOrAtom = function () {
        var location = this.currentLocation();
        // Lambda: |:param, ...| => expr
        if (this.check(types_1.TokenType.BAR) && !this.checkNext(types_1.TokenType.DOT)) {
            return this.parseLambda();
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
            var name_1 = this.advance().value;
            // Check for function call
            if (this.match(types_1.TokenType.LPAREN)) {
                var args = [];
                if (!this.check(types_1.TokenType.RPAREN)) {
                    args.push(this.parseExpression());
                    while (this.match(types_1.TokenType.COMMA)) {
                        args.push(this.parseExpression());
                    }
                }
                this.consume(types_1.TokenType.RPAREN, 'Expected )');
                return {
                    type: 'CallExpression',
                    location: location,
                    callee: name_1,
                    args: args
                };
            }
            // Just an identifier
            return {
                type: 'Identifier',
                location: location,
                name: name_1
            };
        }
        this.error('Expected expression');
        throw new Error('Unreachable');
    };
    Parser.prototype.parseLambda = function () {
        var location = this.currentLocation();
        this.consume(types_1.TokenType.BAR, 'Expected |');
        var params = [];
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
        var body = this.parseCallOrAtom();
        return {
            type: 'Lambda',
            location: location,
            params: params,
            body: body
        };
    };
    // ============================================================================
    // Literals
    // ============================================================================
    Parser.prototype.parseNumberLiteral = function () {
        var location = this.currentLocation();
        var token = this.consume(types_1.TokenType.NUMBER, 'Expected number');
        return {
            type: 'NumberLiteral',
            location: location,
            value: parseFloat(token.value)
        };
    };
    Parser.prototype.parseStringLiteral = function () {
        var location = this.currentLocation();
        var token = this.consume(types_1.TokenType.STRING, 'Expected string');
        var hasInterpolation = token.value.includes('#{');
        return {
            type: 'StringLiteral',
            location: location,
            value: token.value,
            hasInterpolation: hasInterpolation
        };
    };
    Parser.prototype.parseBooleanLiteral = function () {
        var location = this.currentLocation();
        var token = this.consume(types_1.TokenType.BOOLEAN, 'Expected boolean');
        return {
            type: 'BooleanLiteral',
            location: location,
            value: token.value === 'true'
        };
    };
    Parser.prototype.parseListLiteral = function () {
        var location = this.currentLocation();
        this.consume(types_1.TokenType.LBRACKET, 'Expected [');
        var elements = [];
        if (!this.check(types_1.TokenType.RBRACKET)) {
            elements.push(this.parseExpression());
            while (this.match(types_1.TokenType.COMMA)) {
                elements.push(this.parseExpression());
            }
        }
        this.consume(types_1.TokenType.RBRACKET, 'Expected ]');
        return {
            type: 'ListLiteral',
            location: location,
            elements: elements
        };
    };
    Parser.prototype.parseRecordLiteral = function () {
        var location = this.currentLocation();
        var typeName = this.consume(types_1.TokenType.TYPE_NAME, 'Expected type name').value;
        this.consume(types_1.TokenType.LBRACE, 'Expected {');
        var fields = [];
        if (!this.check(types_1.TokenType.RBRACE)) {
            // field: value
            var name_2 = this.consume(types_1.TokenType.IDENTIFIER, 'Expected field name').value;
            this.consume(types_1.TokenType.COLON, 'Expected :');
            var value = this.parseExpression();
            fields.push({ name: name_2, value: value });
            while (this.match(types_1.TokenType.COMMA)) {
                var name_3 = this.consume(types_1.TokenType.IDENTIFIER, 'Expected field name').value;
                this.consume(types_1.TokenType.COLON, 'Expected :');
                var value_1 = this.parseExpression();
                fields.push({ name: name_3, value: value_1 });
            }
        }
        this.consume(types_1.TokenType.RBRACE, 'Expected }');
        return {
            type: 'RecordLiteral',
            location: location,
            typeName: typeName,
            fields: fields
        };
    };
    // ============================================================================
    // Stream Operations
    // ============================================================================
    Parser.prototype.tryParseStreamEmit = function () {
        if (!this.check(types_1.TokenType.AT) && !this.check(types_1.TokenType.AT_REDIRECT)) {
            return null;
        }
        var location = this.currentLocation();
        var isRedirect = this.match(types_1.TokenType.AT_REDIRECT);
        if (!isRedirect) {
            this.consume(types_1.TokenType.AT, 'Expected @');
        }
        var streams = [];
        // @"stream" or @("stream1", "stream2")
        if (this.match(types_1.TokenType.LPAREN)) {
            // Fan-out: multiple streams
            streams.push(this.consume(types_1.TokenType.STRING, 'Expected stream name').value);
            while (this.match(types_1.TokenType.COMMA)) {
                streams.push(this.consume(types_1.TokenType.STRING, 'Expected stream name').value);
            }
            this.consume(types_1.TokenType.RPAREN, 'Expected )');
        }
        else {
            // Single stream
            streams.push(this.consume(types_1.TokenType.STRING, 'Expected stream name').value);
        }
        // Check for XX termination
        var terminates = this.match(types_1.TokenType.XX);
        return {
            type: 'StreamEmit',
            location: location,
            isRedirect: isRedirect,
            streams: streams,
            terminates: terminates
        };
    };
    Parser.prototype.parseOutcomeMatch = function () {
        var location = this.currentLocation();
        this.consume(types_1.TokenType.BAR, 'Expected |');
        this.consume(types_1.TokenType.DOT, 'Expected .');
        var outcomeName = this.consume(types_1.TokenType.IDENTIFIER, 'Expected outcome name').value;
        this.consume(types_1.TokenType.ARROW, 'Expected =>');
        // Handler can be:
        // 1. Just a stream emit: | .fail => @"errors"
        // 2. An expression followed by optional stream emit: | .fail => log() @"errors"
        var handler;
        var streamEmit = null;
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
            location: location,
            outcomeName: outcomeName,
            handler: handler,
            streamEmit: streamEmit
        };
    };
    // ============================================================================
    // Contingencies
    // ============================================================================
    Parser.prototype.parseOnHandler = function () {
        var location = this.currentLocation();
        this.consume(types_1.TokenType.ON, 'Expected on');
        // Stream pattern: @"pattern"
        this.consume(types_1.TokenType.AT, 'Expected @');
        var streamPattern = this.consume(types_1.TokenType.STRING, 'Expected stream pattern').value;
        this.consume(types_1.TokenType.PIPE, 'Expected |>');
        var handler = this.parseLambda();
        var streamEmit = this.tryParseStreamEmit();
        return {
            type: 'OnHandler',
            location: location,
            streamPattern: streamPattern,
            handler: handler,
            streamEmit: streamEmit
        };
    };
    // ============================================================================
    // Utilities
    // ============================================================================
    Parser.prototype.match = function (type) {
        if (this.check(type)) {
            this.advance();
            return true;
        }
        return false;
    };
    Parser.prototype.check = function (type) {
        if (this.isAtEnd())
            return false;
        return this.peek().type === type;
    };
    Parser.prototype.checkIdentifier = function (value) {
        if (this.isAtEnd())
            return false;
        var token = this.peek();
        return token.type === types_1.TokenType.IDENTIFIER && token.value === value;
    };
    Parser.prototype.checkNext = function (type) {
        var next = this.peekNext();
        return next !== null && next.type === type;
    };
    Parser.prototype.checkAhead = function (type, distance) {
        if (this.current + distance >= this.tokens.length)
            return false;
        return this.tokens[this.current + distance].type === type;
    };
    Parser.prototype.advance = function () {
        if (!this.isAtEnd())
            this.current++;
        return this.previous();
    };
    Parser.prototype.isAtEnd = function () {
        return this.peek().type === types_1.TokenType.EOF;
    };
    Parser.prototype.peek = function () {
        return this.tokens[this.current];
    };
    Parser.prototype.peekNext = function () {
        if (this.current + 1 >= this.tokens.length)
            return null;
        return this.tokens[this.current + 1];
    };
    Parser.prototype.previous = function () {
        return this.tokens[this.current - 1];
    };
    Parser.prototype.consume = function (type, message) {
        if (this.check(type))
            return this.advance();
        var token = this.peek();
        throw new Error("[stroum] error at line ".concat(token.line, ", col ").concat(token.column, ": ").concat(message, " (got ").concat(token.type, ")"));
    };
    Parser.prototype.error = function (message) {
        var token = this.peek();
        throw new Error("[stroum] error at line ".concat(token.line, ", col ").concat(token.column, ": ").concat(message));
    };
    Parser.prototype.currentLocation = function () {
        var token = this.peek();
        return { line: token.line, column: token.column };
    };
    return Parser;
}());
exports.Parser = Parser;
