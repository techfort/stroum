"use strict";
// Token types for Stroum lexer
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenType = void 0;
var TokenType;
(function (TokenType) {
    // Identifiers and literals
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    TokenType["TYPE_NAME"] = "TYPE_NAME";
    TokenType["NUMBER"] = "NUMBER";
    TokenType["STRING"] = "STRING";
    TokenType["BOOLEAN"] = "BOOLEAN";
    // Sigils
    TokenType["SIGIL_BINDING"] = "SIGIL_BINDING";
    TokenType["SIGIL_FUNCTION"] = "SIGIL_FUNCTION";
    TokenType["SIGIL_STRUCT"] = "SIGIL_STRUCT";
    TokenType["SIGIL_IMPORT"] = "SIGIL_IMPORT";
    TokenType["COLON"] = "COLON";
    // Operators - pipe and composition
    TokenType["PIPE"] = "PIPE";
    TokenType["PIPE_PARTIAL"] = "PIPE_PARTIAL";
    TokenType["ARROW"] = "ARROW";
    TokenType["OUTPUT_ARROW"] = "OUTPUT_ARROW";
    // Operators - two-letter uppercase
    TokenType["PP"] = "PP";
    TokenType["XX"] = "XX";
    // Stream operators
    TokenType["AT"] = "AT";
    TokenType["AT_REDIRECT"] = "AT_REDIRECT";
    TokenType["EMIT_CONTRACT"] = "EMIT_CONTRACT";
    // Outcome matching
    TokenType["BAR"] = "BAR";
    TokenType["DOT"] = "DOT";
    // Delimiters
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
    TokenType["LBRACE"] = "LBRACE";
    TokenType["RBRACE"] = "RBRACE";
    TokenType["LBRACKET"] = "LBRACKET";
    TokenType["RBRACKET"] = "RBRACKET";
    TokenType["COMMA"] = "COMMA";
    // Keywords
    TokenType["REC"] = "REC";
    TokenType["ON"] = "ON";
    // Indentation
    TokenType["INDENT"] = "INDENT";
    TokenType["DEDENT"] = "DEDENT";
    TokenType["NEWLINE"] = "NEWLINE";
    // Special
    TokenType["EOF"] = "EOF";
    TokenType["COMMENT"] = "COMMENT";
})(TokenType || (exports.TokenType = TokenType = {}));
