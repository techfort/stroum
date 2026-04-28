import { SourceLocation } from './types';

// AST Node Types for Stroum

export interface ASTNode {
  type: string;
  location: SourceLocation;
}

// ============================================================================
// Module Structure
// ============================================================================

export interface Module extends ASTNode {
  type: 'Module';
  imports: ImportDeclaration[];
  definitions: Declaration[];
  primaryExpressions: Expression[];
  contingencies: Contingency[];
}

// ============================================================================
// Imports
// ============================================================================

export interface ImportDeclaration extends ASTNode {
  type: 'ImportDeclaration';
  modulePath: string; // Module identifier or file path (e.g., "core" or "./utils.stm")
  imports: string[] | null; // Specific functions to import, or null for all
  alias: string | null; // Optional alias for qualified access (e.g., "as c")
}

// ============================================================================
// Declarations
// ============================================================================

export type Declaration = StructDeclaration | FunctionDeclaration | BindingDeclaration;

export interface StructDeclaration extends ASTNode {
  type: 'StructDeclaration';
  name: string; // Type name (Capitalised)
  fields: StructField[];
}

export interface StructField {
  name: string; // lowercase identifier
  typeName: string; // Type name
}

export interface FunctionDeclaration extends ASTNode {
  type: 'FunctionDeclaration';
  isRecursive: boolean;
  name: string;
  params: string[]; // parameter names
  emissionContract: string[] | null; // stream names from ~>
  body: Expression | IndentedBody;
}

export interface BindingDeclaration extends ASTNode {
  type: 'BindingDeclaration';
  name: string;
  value: Expression;
  hasExplicitSigil: boolean; // whether b: was used
}

export interface IndentedBody extends ASTNode {
  type: 'IndentedBody';
  statements: (BindingDeclaration | Expression)[];
}

// ============================================================================
// Expressions
// ============================================================================

export type Expression =
  | ParallelExpression
  | PipeExpression
  | CallExpression
  | Lambda
  | IfExpression
  | TaggedExpression
  | Literal
  | Identifier;

export interface ParallelExpression extends ASTNode {
  type: 'ParallelExpression';
  branches: PipeExpression[];
  gatherPipe: GatherPipe;
}

export interface GatherPipe extends ASTNode {
  type: 'GatherPipe';
  isPartial: boolean; // |?> vs |>
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

// ============================================================================
// Literals
// ============================================================================

export type Literal = NumberLiteral | StringLiteral | BooleanLiteral | ListLiteral | RecordLiteral;

export interface NumberLiteral extends ASTNode {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteral extends ASTNode {
  type: 'StringLiteral';
  value: string;
  hasInterpolation: boolean; // contains #{}
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

// ============================================================================
// Conditional Expressions
// ============================================================================

export interface IfExpression extends ASTNode {
  type: 'IfExpression';
  condition: Expression;
  thenBranch: Expression;
  elseBranch: Expression;
}

// ============================================================================
// Stream Operations
// ============================================================================

// A stream target is either a static string literal or a dynamic binding reference.
export interface StreamRef {
  name: string;       // string value (static) or binding identifier (dynamic)
  isDynamic: boolean; // true when @ok (identifier), false when @"ok" (literal)
}

// A tag reference — always a static string name.
// .".just right" uses a string literal; .fail uses an identifier (treated as static tag name).
export interface TagRef {
  name: string;   // the tag name string
}

// ============================================================================
// Tagged Expressions
// ============================================================================

// ."tag" value  or  .name value  — wraps value with an outcome tag.
export interface TaggedExpression extends ASTNode {
  type: 'TaggedExpression';
  tag: TagRef;
  value: Expression;
}

export interface StreamEmit extends ASTNode {
  type: 'StreamEmit';
  isRedirect: boolean; // @> vs @
  streams: StreamRef[];
  terminates: boolean; // XX suffix
}

export interface OutcomeMatch extends ASTNode {
  type: 'OutcomeMatch';
  tag: TagRef;          // the outcome tag to match (was: outcomeName: string)
  handler: Expression;
  streamEmit: StreamEmit | null;
}

// ============================================================================
// Contingencies
// ============================================================================

export type Contingency = OnHandler | RouteDeclaration | OutcomeMatch;

export interface OnHandler extends ASTNode {
  type: 'OnHandler';
  streamPattern: string; // may contain * and #{}
  handler: Lambda;
  streamEmit: StreamEmit | null;
}

// route @"stream" |> op1 |> op2
// route @ binding |> op1 |> op2
// Subscribes the pipeline as the continuation handler for a stream.
// The emitted value becomes the first input to the pipeline.
export interface RouteDeclaration extends ASTNode {
  type: 'RouteDeclaration';
  streamPattern: StreamRef;
  pipeline: Expression; // the pipe chain — receives emitted value as first arg
}
