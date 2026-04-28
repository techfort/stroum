export declare enum TokenType {
    IDENTIFIER = "IDENTIFIER",// lowercase: foo, my_var
    TYPE_NAME = "TYPE_NAME",// Capitalised: User, Payload
    NUMBER = "NUMBER",// 42, 3.14
    STRING = "STRING",// "hello"
    BOOLEAN = "BOOLEAN",// true, false
    SIGIL_BINDING = "SIGIL_BINDING",// b:
    SIGIL_FUNCTION = "SIGIL_FUNCTION",// f:
    SIGIL_STRUCT = "SIGIL_STRUCT",// s:
    SIGIL_IMPORT = "SIGIL_IMPORT",// i:
    COLON = "COLON",// :
    PIPE = "PIPE",// |>
    PIPE_PARTIAL = "PIPE_PARTIAL",// |?>
    ARROW = "ARROW",// =>
    OUTPUT_ARROW = "OUTPUT_ARROW",// -> (reserved, unused in v1)
    PP = "PP",// Parallel composition
    XX = "XX",// Stream termination
    AT = "AT",// @
    AT_REDIRECT = "AT_REDIRECT",// @>
    EMIT_CONTRACT = "EMIT_CONTRACT",// ~>
    BAR = "BAR",// |
    DOT = "DOT",// .
    LPAREN = "LPAREN",// (
    RPAREN = "RPAREN",// )
    LBRACE = "LBRACE",// {
    RBRACE = "RBRACE",// }
    LBRACKET = "LBRACKET",// [
    RBRACKET = "RBRACKET",// ]
    COMMA = "COMMA",// ,
    REC = "REC",// rec
    ON = "ON",// on
    ROUTE = "ROUTE",// route
    IF = "IF",// if
    THEN = "THEN",// then
    ELSE = "ELSE",// else
    INDENT = "INDENT",
    DEDENT = "DEDENT",
    NEWLINE = "NEWLINE",
    EOF = "EOF",
    COMMENT = "COMMENT"
}
export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}
export interface SourceLocation {
    line: number;
    column: number;
}
//# sourceMappingURL=types.d.ts.map