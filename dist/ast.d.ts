import { SourceLocation } from './types';
export interface ASTNode {
    type: string;
    location: SourceLocation;
}
export interface Module extends ASTNode {
    type: 'Module';
    imports: ImportDeclaration[];
    definitions: Declaration[];
    primaryExpressions: Expression[];
    contingencies: Contingency[];
}
export interface ImportDeclaration extends ASTNode {
    type: 'ImportDeclaration';
    modulePath: string;
    imports: string[] | null;
    alias: string | null;
}
export type Declaration = StructDeclaration | FunctionDeclaration | BindingDeclaration;
export interface StructDeclaration extends ASTNode {
    type: 'StructDeclaration';
    name: string;
    fields: StructField[];
}
export interface StructField {
    name: string;
    typeName: string;
}
export interface FunctionDeclaration extends ASTNode {
    type: 'FunctionDeclaration';
    isRecursive: boolean;
    name: string;
    params: string[];
    emissionContract: string[] | null;
    body: Expression | IndentedBody;
}
export interface BindingDeclaration extends ASTNode {
    type: 'BindingDeclaration';
    name: string;
    value: Expression;
    hasExplicitSigil: boolean;
}
export interface IndentedBody extends ASTNode {
    type: 'IndentedBody';
    statements: (BindingDeclaration | Expression)[];
}
export type Expression = ParallelExpression | PipeExpression | CallExpression | Lambda | IfExpression | TaggedExpression | Literal | Identifier;
export interface ParallelExpression extends ASTNode {
    type: 'ParallelExpression';
    branches: PipeExpression[];
    gatherPipe: GatherPipe;
}
export interface GatherPipe extends ASTNode {
    type: 'GatherPipe';
    isPartial: boolean;
    target: Expression;
    streamEmit: StreamEmit | null;
}
export interface PipeExpression extends ASTNode {
    type: 'PipeExpression';
    stages: Expression[];
    streamEmit: StreamEmit | null;
    outcomeMatches: OutcomeMatch[];
}
export interface CallExpression extends ASTNode {
    type: 'CallExpression';
    callee: string;
    args: Expression[];
}
export interface Lambda extends ASTNode {
    type: 'Lambda';
    params: string[];
    body: Expression;
}
export interface Identifier extends ASTNode {
    type: 'Identifier';
    name: string;
}
export type Literal = NumberLiteral | StringLiteral | BooleanLiteral | ListLiteral | RecordLiteral;
export interface NumberLiteral extends ASTNode {
    type: 'NumberLiteral';
    value: number;
}
export interface StringLiteral extends ASTNode {
    type: 'StringLiteral';
    value: string;
    hasInterpolation: boolean;
}
export interface BooleanLiteral extends ASTNode {
    type: 'BooleanLiteral';
    value: boolean;
}
export interface ListLiteral extends ASTNode {
    type: 'ListLiteral';
    elements: Expression[];
}
export interface RecordLiteral extends ASTNode {
    type: 'RecordLiteral';
    typeName: string;
    fields: RecordField[];
}
export interface RecordField {
    name: string;
    value: Expression;
}
export interface IfExpression extends ASTNode {
    type: 'IfExpression';
    condition: Expression;
    thenBranch: Expression;
    elseBranch: Expression;
}
export interface StreamRef {
    name: string;
    isDynamic: boolean;
}
export interface TagRef {
    name: string;
}
export interface TaggedExpression extends ASTNode {
    type: 'TaggedExpression';
    tag: TagRef;
    value: Expression;
}
export interface StreamEmit extends ASTNode {
    type: 'StreamEmit';
    isRedirect: boolean;
    streams: StreamRef[];
    terminates: boolean;
}
export interface OutcomeMatch extends ASTNode {
    type: 'OutcomeMatch';
    tag: TagRef;
    handler: Expression;
    streamEmit: StreamEmit | null;
}
export type Contingency = OnHandler | RouteDeclaration | OutcomeMatch;
export interface OnHandler extends ASTNode {
    type: 'OnHandler';
    streamPattern: string;
    handler: Lambda;
    streamEmit: StreamEmit | null;
}
export interface RouteDeclaration extends ASTNode {
    type: 'RouteDeclaration';
    streamPattern: StreamRef;
    pipeline: Expression;
}
//# sourceMappingURL=ast.d.ts.map