import type { SourceLocation } from "./types";

// AST Node Types for Stroum

export interface ASTNode {
  type: string;
  location: SourceLocation;
}

// ============================================================================
// Module Structure
// ============================================================================

export interface Module extends ASTNode {
  type: "Module";
  imports: ImportDeclaration[];
  streamDeclarations: StreamDeclaration[];
  inputDeclarations: InputDeclaration[];
  outputDeclarations: OutputDeclaration[];
  wireDeclarations: WireDeclaration[];
  sourceDeclarations: SourceDeclaration[];
  sinkDeclarations: SinkDeclaration[];
  definitions: Declaration[];
  testDeclarations: TestDeclaration[];
  primaryExpressions: Expression[];
  contingencies: Contingency[];
  runtimeDeclaration: RuntimeDeclaration | null;
}

// ============================================================================
// Imports
// ============================================================================

export interface ImportDeclaration extends ASTNode {
  type: "ImportDeclaration";
  modulePath: string; // Module identifier or file path (e.g., "core" or "./utils.stm")
  imports: string[] | null; // Specific functions to import, or null for all
  alias: string | null; // Optional alias for qualified access (e.g., "as c")
}

export interface StreamDeclaration extends ASTNode {
  type: "StreamDeclaration";
  name: string;
  valueType: string;
}

export interface InputDeclaration extends ASTNode {
  type: "InputDeclaration";
  stream: StreamRef;
}

export interface OutputDeclaration extends ASTNode {
  type: "OutputDeclaration";
  stream: StreamRef;
}

export interface WireDeclaration extends ASTNode {
  type: "WireDeclaration";
  from: StreamRef;
  to: StreamRef;
}

// ============================================================================
// Sources and Runtime
// ============================================================================

export interface SourceDeclaration extends ASTNode {
  type: "SourceDeclaration";
  stream: StreamRef;
  source: Expression;
}

export interface SinkDeclaration extends ASTNode {
  type: "SinkDeclaration";
  stream: StreamRef;
  sink: Expression;
}

export type RuntimeDeclaration = RunUntilDeclaration | RunForeverDeclaration;

export interface RunUntilDeclaration extends ASTNode {
  type: "RunUntilDeclaration";
  condition: RuntimeCondition;
}

export interface RunForeverDeclaration extends ASTNode {
  type: "RunForeverDeclaration";
}

export type RuntimeCondition =
  | SignalCondition
  | StreamCondition
  | TimeoutCondition;

export interface SignalCondition {
  type: "SignalCondition";
}

export interface StreamCondition {
  type: "StreamCondition";
  stream: StreamRef;
}

export interface TimeoutCondition {
  type: "TimeoutCondition";
  duration: Expression;
}

// ============================================================================
// Declarations
// ============================================================================

export type Declaration =
  | StructDeclaration
  | FunctionDeclaration
  | BindingDeclaration;

export interface TestDeclaration extends ASTNode {
  type: 'TestDeclaration';
  label: string;
  body: IndentedBody;
}

export interface StructDeclaration extends ASTNode {
  type: "StructDeclaration";
  name: string; // Type name (Capitalised)
  fields: StructField[];
}

export interface StructField {
  name: string; // lowercase identifier
  typeName: string; // Type name
}

export interface FunctionDeclaration extends ASTNode {
  type: "FunctionDeclaration";
  isRecursive: boolean;
  name: string;
  params: string[]; // parameter names
  paramTypes: string[]; // parallel to params; "Fn" for function-valued params
  returnType: string; // required; "Void" for procedures
  emissionContract: string[] | null; // stream names from ~>
  body: Expression | IndentedBody;
}

export interface BindingDeclaration extends ASTNode {
  type: "BindingDeclaration";
  name: string;
  value: Expression;
  hasExplicitSigil: boolean; // whether b: was used
}

export interface IndentedBody extends ASTNode {
  type: "IndentedBody";
  statements: (BindingDeclaration | Expression)[];
}

// ============================================================================
// Expressions
// ============================================================================

export type Expression =
  | ParallelExpression
  | PipeExpression
  | CallExpression
  | FieldAccessExpression
  | StreamSymbol
  | Lambda
  | IfExpression
  | TaggedExpression
  | Literal
  | Identifier;

export interface ParallelExpression extends ASTNode {
  type: "ParallelExpression";
  branches: PipeExpression[];
  gatherPipe: GatherPipe;
}

export interface GatherPipe extends ASTNode {
  type: "GatherPipe";
  isPartial: boolean; // |?> vs |>
  target: Expression;
  streamEmit: StreamEmit | null;
}

export interface PipeExpression extends ASTNode {
  type: "PipeExpression";
  stages: Expression[];
  streamEmit: StreamEmit | null;
  outcomeMatches: OutcomeMatch[];
}

export interface CallExpression extends ASTNode {
  type: "CallExpression";
  callee: string;
  args: Expression[];
}

export interface FieldAccessExpression extends ASTNode {
  type: "FieldAccessExpression";
  receiver: Expression;
  field: string;
  dynamic?: true; // present when accessed via a."string" syntax
}

export interface Lambda extends ASTNode {
  type: "Lambda";
  params: string[];
  paramTypes: string[]; // mandatory, parallel to params
  body: Expression;
}

export interface Identifier extends ASTNode {
  type: "Identifier";
  name: string;
}

// Stream symbol literal used in expression positions, e.g. stream_info(@raw)
export interface StreamSymbol extends ASTNode {
  type: "StreamSymbol";
  name: string;
}

// ============================================================================
// Literals
// ============================================================================

export type Literal =
  | NumberLiteral
  | StringLiteral
  | InterpolatedStringLiteral
  | BooleanLiteral
  | ListLiteral
  | RecordLiteral;

export interface NumberLiteral extends ASTNode {
  type: "NumberLiteral";
  value: number;
}

export interface StringLiteral extends ASTNode {
  type: "StringLiteral";
  value: string;
  hasInterpolation: boolean; // contains #{}
}

// A segment in an interpolated string: either a plain text run or an embedded expression.
export type InterpolationSegment =
  | { kind: "text"; value: string }
  | { kind: "expr"; expression: Expression };

export interface InterpolatedStringLiteral extends ASTNode {
  type: "InterpolatedStringLiteral";
  segments: InterpolationSegment[];
}

export interface BooleanLiteral extends ASTNode {
  type: "BooleanLiteral";
  value: boolean;
}

export interface ListLiteral extends ASTNode {
  type: "ListLiteral";
  elements: Expression[];
  elementType?: string;
}

export interface RecordLiteral extends ASTNode {
  type: "RecordLiteral";
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
  type: "IfExpression";
  condition: Expression;
  thenBranch: Expression;
  elseBranch: Expression;
}

// ============================================================================
// Stream Operations
// ============================================================================

// Stream references are identifier-only at syntax level: @raw, @errors, ...
export interface StreamRef {
  name: string;
}

// A tag reference — always a static string name.
// .".just right" uses a string literal; .fail uses an identifier (treated as static tag name).
export interface TagRef {
  name: string; // the tag name string
}

// ============================================================================
// Tagged Expressions
// ============================================================================

// ."tag" value  or  .name value  — wraps value with an outcome tag.
export interface TaggedExpression extends ASTNode {
  type: "TaggedExpression";
  tag: TagRef;
  value: Expression;
}

export interface StreamEmit extends ASTNode {
  type: "StreamEmit";
  isRedirect: boolean; // @> vs @
  streams: StreamRef[];
  terminates: boolean; // XX suffix
}

export interface OutcomeMatch extends ASTNode {
  type: "OutcomeMatch";
  tag: TagRef; // the outcome tag to match (was: outcomeName: string)
  handler: Expression;
  streamEmit: StreamEmit | null;
}

// ============================================================================
// Contingencies
// ============================================================================

export type Contingency = OnHandler | RouteDeclaration | OutcomeMatch;

export interface OnHandler extends ASTNode {
  type: "OnHandler";
  streamPattern: StreamRef;
  handler: Lambda;
  streamEmit: StreamEmit | null;
}

// route @stream |> op1 |> op2
// Subscribes the pipeline as the continuation handler for a stream.
// The emitted value becomes the first input to the pipeline.
export interface RouteDeclaration extends ASTNode {
  type: "RouteDeclaration";
  streamPattern: StreamRef;
  pipeline: Expression; // the pipe chain — receives emitted value as first arg
}
