"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = void 0;
const types_1 = require("./types");
class Lexer {
    constructor(source) {
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.tokens = [];
        this.indentStack = [0]; // Track indentation levels
        this.source = source;
    }
    tokenize() {
        while (!this.isAtEnd()) {
            this.scanToken();
        }
        // Emit any remaining dedents at end of file
        while (this.indentStack.length > 1) {
            this.indentStack.pop();
            this.addToken(types_1.TokenType.DEDENT, '');
        }
        this.addToken(types_1.TokenType.EOF, '');
        return this.tokens;
    }
    scanToken() {
        const start = this.position;
        const startLine = this.line;
        const startColumn = this.column;
        // Handle newlines and indentation
        if (this.match('\n')) {
            this.line++;
            this.column = 1;
            // Check if next line is indented
            const indentLevel = this.measureIndentation();
            if (indentLevel !== null) {
                const currentIndent = this.indentStack[this.indentStack.length - 1];
                if (indentLevel > currentIndent) {
                    this.indentStack.push(indentLevel);
                    this.addToken(types_1.TokenType.INDENT, '');
                }
                else if (indentLevel < currentIndent) {
                    while (this.indentStack.length > 1 && this.indentStack[this.indentStack.length - 1] > indentLevel) {
                        this.indentStack.pop();
                        this.addToken(types_1.TokenType.DEDENT, '');
                    }
                    if (this.indentStack[this.indentStack.length - 1] !== indentLevel) {
                        this.error(startLine, startColumn, 'Inconsistent indentation');
                    }
                }
            }
            return;
        }
        // Skip whitespace (but not newlines, handled above)
        if (this.isWhitespace(this.peek())) {
            this.advance();
            return;
        }
        // Comments
        if (this.peek() === '-' && this.peekNext() === '-') {
            this.skipComment();
            return;
        }
        // String literals
        if (this.match('"')) {
            this.scanString();
            return;
        }
        // Numbers
        if (this.isDigit(this.peek())) {
            this.scanNumber();
            return;
        }
        // Multi-character operators and sigils
        const char = this.peek();
        const nextChar = this.peekNext();
        // |> or |?> or |
        if (char === '|') {
            this.advance();
            if (this.match('?')) {
                if (this.match('>')) {
                    this.addToken(types_1.TokenType.PIPE_PARTIAL, '|?>');
                    return;
                }
                this.error(startLine, startColumn, 'Unexpected character after |?');
            }
            else if (this.match('>')) {
                this.addToken(types_1.TokenType.PIPE, '|>');
                return;
            }
            else {
                this.addToken(types_1.TokenType.BAR, '|');
                return;
            }
        }
        // => or ->
        if (char === '=') {
            this.advance();
            if (this.match('>')) {
                this.addToken(types_1.TokenType.ARROW, '=>');
                return;
            }
            this.error(startLine, startColumn, 'Unexpected = (did you mean =>?)');
            return;
        }
        if (char === '-') {
            this.advance();
            if (this.match('>')) {
                this.addToken(types_1.TokenType.OUTPUT_ARROW, '->');
                return;
            }
            this.error(startLine, startColumn, 'Unexpected - (did you mean -> or --?)');
            return;
        }
        // @> or @
        if (char === '@') {
            this.advance();
            if (this.match('>')) {
                this.addToken(types_1.TokenType.AT_REDIRECT, '@>');
                return;
            }
            this.addToken(types_1.TokenType.AT, '@');
            return;
        }
        // ~>
        if (char === '~') {
            this.advance();
            if (this.match('>')) {
                this.addToken(types_1.TokenType.EMIT_CONTRACT, '~>');
                return;
            }
            this.error(startLine, startColumn, 'Unexpected ~ (did you mean ~>?)');
            return;
        }
        // Sigils: b:, f:, s:, i:, or just :
        if (char === 'b' && nextChar === ':') {
            this.advance();
            this.advance();
            this.addToken(types_1.TokenType.SIGIL_BINDING, 'b:');
            return;
        }
        if (char === 'f' && nextChar === ':') {
            this.advance();
            this.advance();
            this.addToken(types_1.TokenType.SIGIL_FUNCTION, 'f:');
            return;
        }
        if (char === 's' && nextChar === ':') {
            this.advance();
            this.advance();
            this.addToken(types_1.TokenType.SIGIL_STRUCT, 's:');
            return;
        }
        if (char === 'i' && nextChar === ':') {
            this.advance();
            this.advance();
            this.addToken(types_1.TokenType.SIGIL_IMPORT, 'i:');
            return;
        }
        if (char === ':') {
            this.advance();
            this.addToken(types_1.TokenType.COLON, ':');
            return;
        }
        // Single character delimiters
        if (char === '(') {
            this.advance();
            this.addToken(types_1.TokenType.LPAREN, '(');
            return;
        }
        if (char === ')') {
            this.advance();
            this.addToken(types_1.TokenType.RPAREN, ')');
            return;
        }
        if (char === '{') {
            this.advance();
            this.addToken(types_1.TokenType.LBRACE, '{');
            return;
        }
        if (char === '}') {
            this.advance();
            this.addToken(types_1.TokenType.RBRACE, '}');
            return;
        }
        if (char === '[') {
            this.advance();
            this.addToken(types_1.TokenType.LBRACKET, '[');
            return;
        }
        if (char === ']') {
            this.advance();
            this.addToken(types_1.TokenType.RBRACKET, ']');
            return;
        }
        if (char === ',') {
            this.advance();
            this.addToken(types_1.TokenType.COMMA, ',');
            return;
        }
        if (char === '.') {
            this.advance();
            this.addToken(types_1.TokenType.DOT, '.');
            return;
        }
        // Identifiers, keywords, type names, or two-letter operators (PP, XX)
        // Also handle identifiers starting with underscore (for __builtin_* functions)
        if (this.isAlpha(char) || char === '_') {
            this.scanIdentifierOrKeyword();
            return;
        }
        this.error(startLine, startColumn, `Unexpected character: ${char}`);
        this.advance();
    }
    scanString() {
        const startLine = this.line;
        const startColumn = this.column - 1;
        let value = '';
        while (!this.isAtEnd() && this.peek() !== '"') {
            if (this.peek() === '\n') {
                this.error(startLine, startColumn, 'Unterminated string literal');
                return;
            }
            // Note: We recognize #{} interpolation syntax but don't parse it in v1
            // The parser/transpiler will handle this later
            if (this.peek() === '\\') {
                this.advance();
                if (!this.isAtEnd()) {
                    const escaped = this.peek();
                    this.advance();
                    switch (escaped) {
                        case 'n':
                            value += '\n';
                            break;
                        case 't':
                            value += '\t';
                            break;
                        case 'r':
                            value += '\r';
                            break;
                        case '\\':
                            value += '\\';
                            break;
                        case '"':
                            value += '"';
                            break;
                        case '0':
                            value += '\0';
                            break;
                        default:
                            value += escaped;
                            break;
                    }
                }
            }
            else {
                value += this.peek();
                this.advance();
            }
        }
        if (this.isAtEnd()) {
            this.error(startLine, startColumn, 'Unterminated string literal');
            return;
        }
        // Closing quote
        this.advance();
        this.addToken(types_1.TokenType.STRING, value);
    }
    scanNumber() {
        const start = this.position;
        while (this.isDigit(this.peek())) {
            this.advance();
        }
        // Check for decimal part
        if (this.peek() === '.' && this.isDigit(this.peekNext())) {
            this.advance(); // consume .
            while (this.isDigit(this.peek())) {
                this.advance();
            }
        }
        const value = this.source.substring(start, this.position);
        this.addToken(types_1.TokenType.NUMBER, value);
    }
    scanIdentifierOrKeyword() {
        const start = this.position;
        const startColumn = this.column;
        // First, read the entire token
        this.advance();
        while (this.isAlphaNumeric(this.peek()) || this.peek() === '_') {
            this.advance();
        }
        const value = this.source.substring(start, this.position);
        // Check for two-letter uppercase operators first
        if (value === 'PP' || value === 'XX') {
            this.addToken(value === 'PP' ? types_1.TokenType.PP : types_1.TokenType.XX, value);
            return;
        }
        // Check for keywords
        if (value === 'rec') {
            this.addToken(types_1.TokenType.REC, value);
            return;
        }
        if (value === 'on') {
            this.addToken(types_1.TokenType.ON, value);
            return;
        }
        if (value === 'route') {
            this.addToken(types_1.TokenType.ROUTE, value);
            return;
        }
        if (value === 'if') {
            this.addToken(types_1.TokenType.IF, value);
            return;
        }
        if (value === 'then') {
            this.addToken(types_1.TokenType.THEN, value);
            return;
        }
        if (value === 'else') {
            this.addToken(types_1.TokenType.ELSE, value);
            return;
        }
        if (value === 'true' || value === 'false') {
            this.addToken(types_1.TokenType.BOOLEAN, value);
            return;
        }
        // Check if it's a type name (Capitalised: first uppercase, rest lowercase)
        const isTypeName = this.isUppercase(value[0]);
        if (isTypeName) {
            // Validate type name format: first uppercase, rest lowercase only
            for (let i = 1; i < value.length; i++) {
                if (!this.isLowercase(value[i])) {
                    this.error(this.line, startColumn, 'Invalid type name: must be Capitalised (first letter uppercase, rest lowercase)');
                    return;
                }
            }
            this.addToken(types_1.TokenType.TYPE_NAME, value);
            return;
        }
        // Otherwise it's an identifier - must be lowercase only (with underscores and numbers allowed)
        for (let i = 0; i < value.length; i++) {
            const char = value[i];
            if (this.isUppercase(char)) {
                this.error(this.line, startColumn, 'Identifiers must be lowercase only');
                return;
            }
        }
        this.addToken(types_1.TokenType.IDENTIFIER, value);
    }
    skipComment() {
        // Skip until end of line
        while (!this.isAtEnd() && this.peek() !== '\n') {
            this.advance();
        }
    }
    measureIndentation() {
        let spaces = 0;
        let pos = this.position;
        while (pos < this.source.length) {
            const char = this.source[pos];
            if (char === ' ') {
                spaces++;
                pos++;
            }
            else if (char === '\t') {
                // Treat tab as 4 spaces
                spaces += 4;
                pos++;
            }
            else if (char === '\n') {
                // Empty line, ignore
                return null;
            }
            else if (char === '-' && pos + 1 < this.source.length && this.source[pos + 1] === '-') {
                // Comment line, ignore
                return null;
            }
            else {
                // Non-whitespace, return indent level
                this.position = pos;
                this.column += spaces;
                return spaces;
            }
        }
        return null;
    }
    match(expected) {
        if (this.isAtEnd())
            return false;
        if (this.peek() !== expected)
            return false;
        this.advance();
        return true;
    }
    peek() {
        if (this.isAtEnd())
            return '\0';
        return this.source[this.position];
    }
    peekNext() {
        if (this.position + 1 >= this.source.length)
            return '\0';
        return this.source[this.position + 1];
    }
    advance() {
        const char = this.source[this.position];
        this.position++;
        this.column++;
        return char;
    }
    isAtEnd() {
        return this.position >= this.source.length;
    }
    isDigit(char) {
        return char >= '0' && char <= '9';
    }
    isAlpha(char) {
        return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
    }
    isAlphaNumeric(char) {
        return this.isAlpha(char) || this.isDigit(char);
    }
    isUppercase(char) {
        return char >= 'A' && char <= 'Z';
    }
    isLowercase(char) {
        return char >= 'a' && char <= 'z';
    }
    isWhitespace(char) {
        return char === ' ' || char === '\t' || char === '\r';
    }
    addToken(type, value) {
        this.tokens.push({
            type,
            value,
            line: this.line,
            column: this.column - value.length
        });
    }
    error(line, column, message) {
        throw new Error(`[stroum] error at line ${line}, col ${column}: ${message}`);
    }
}
exports.Lexer = Lexer;
//# sourceMappingURL=lexer.js.map