import { Token } from './types';
export declare class Lexer {
    private source;
    private position;
    private line;
    private column;
    private tokens;
    private indentStack;
    constructor(source: string);
    tokenize(): Token[];
    private scanToken;
    private scanString;
    private scanNumber;
    private scanIdentifierOrKeyword;
    private skipComment;
    private measureIndentation;
    private match;
    private peek;
    private peekNext;
    private advance;
    private isAtEnd;
    private isDigit;
    private isAlpha;
    private isAlphaNumeric;
    private isUppercase;
    private isLowercase;
    private isWhitespace;
    private addToken;
    private error;
}
//# sourceMappingURL=lexer.d.ts.map