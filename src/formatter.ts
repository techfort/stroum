import type * as AST from "./ast";

const INDENT = "  ";

// ─── Expression formatting ────────────────────────────────────────────────────

function fmtExpr(expr: AST.Expression, depth = 0): string {
  switch (expr.type) {
    case "PipeExpression":
      return fmtPipe(expr, depth);
    case "ParallelExpression":
      return fmtParallel(expr, depth);
    case "CallExpression":
      return fmtCall(expr, depth);
    case "FieldAccessExpression":
      return `${fmtExpr(expr.receiver, depth)}.${expr.field}`;
    case "Lambda":
      return fmtLambda(expr, depth);
    case "IfExpression":
      return fmtIf(expr, depth);
    case "TaggedExpression":
      return fmtTagged(expr, depth);
    case "Identifier":
      return expr.name;
    case "NumberLiteral":
      return String(expr.value);
    case "StringLiteral":
      return `"${expr.value}"`;
    case "InterpolatedStringLiteral":
      return fmtInterpolated(expr, depth);
    case "BooleanLiteral":
      return expr.value ? "true" : "false";
    case "ListLiteral":
      return fmtList(expr, depth);
    case "RecordLiteral":
      return fmtRecord(expr, depth);
  }
}

function fmtPipe(expr: AST.PipeExpression, depth: number): string {
  const stages = expr.stages;
  // Pipes are always inline — the parser does not support |> continuation lines
  const base = stages.map((s) => fmtExpr(s, depth)).join(" |> ");

  const emit = expr.streamEmit ? ` ${fmtStreamEmit(expr.streamEmit)}` : "";
  const outcomes =
    expr.outcomeMatches.length > 0
      ? "\n" +
        expr.outcomeMatches
          .map(
            (o) =>
              `${INDENT.repeat(depth + 1)}${fmtOutcomeMatch(o, depth + 1)}`,
          )
          .join("\n")
      : "";

  return base + emit + outcomes;
}

function fmtParallel(expr: AST.ParallelExpression, depth: number): string {
  const ind = INDENT.repeat(depth + 1);
  const branches = expr.branches
    .map((b) => `${ind}${fmtPipe(b, depth + 1)}`)
    .join(",\n");
  const gatherOp = expr.gatherPipe.isPartial ? "|?>" : "|>";
  const gatherTarget = fmtExpr(expr.gatherPipe.target, depth);
  const gatherEmit = expr.gatherPipe.streamEmit
    ? ` ${fmtStreamEmit(expr.gatherPipe.streamEmit)}`
    : "";
  return `(\n${branches}\n${INDENT.repeat(depth)}) ${gatherOp} ${gatherTarget}${gatherEmit}`;
}

function fmtCall(expr: AST.CallExpression, depth: number): string {
  if (expr.args.length === 0) return `${expr.callee}()`;
  const args = expr.args.map((a) => fmtExpr(a, depth));
  // Keep inline if short enough
  const inline = `${expr.callee}(${args.join(", ")})`;
  if (inline.length <= 60) return inline;
  const ind = INDENT.repeat(depth + 1);
  return `${expr.callee}(\n${args.map((a) => ind + a).join(",\n")}\n${INDENT.repeat(depth)})`;
}

function fmtLambda(expr: AST.Lambda, depth: number): string {
  const params = expr.params.map((p) => `:${p}`).join(" ");
  const body = fmtExpr(expr.body, depth);
  return `|${params}| => ${body}`;
}

function fmtIf(expr: AST.IfExpression, depth: number): string {
  const cond = fmtExpr(expr.condition, depth);
  const thenB = fmtExpr(expr.thenBranch, depth);
  const elseB = fmtExpr(expr.elseBranch, depth);
  const inline = `if ${cond} then ${thenB} else ${elseB}`;
  if (inline.length <= 60) return inline;
  const ind = INDENT.repeat(depth + 1);
  return `if ${cond}\n${ind}then ${thenB}\n${ind}else ${elseB}`;
}

function fmtTagged(expr: AST.TaggedExpression, depth: number): string {
  return `.${expr.tag.name} ${fmtExpr(expr.value, depth)}`;
}

function fmtInterpolated(
  expr: AST.InterpolatedStringLiteral,
  depth: number,
): string {
  const inner = expr.segments
    .map((seg) =>
      seg.kind === "text" ? seg.value : `#{${fmtExpr(seg.expression, depth)}}`,
    )
    .join("");
  return `"${inner}"`;
}

function fmtList(expr: AST.ListLiteral, depth: number): string {
  const prefix = expr.elementType ? expr.elementType : "";
  if (expr.elements.length === 0) return `${prefix}[]`;
  const elems = expr.elements.map((e) => fmtExpr(e, depth));
  const inline = `${prefix}[${elems.join(", ")}]`;
  if (inline.length <= 60) return inline;
  const ind = INDENT.repeat(depth + 1);
  return `${prefix}[\n${elems.map((e) => ind + e).join(",\n")}\n${INDENT.repeat(depth)}]`;
}

function fmtRecord(expr: AST.RecordLiteral, depth: number): string {
  if (expr.fields.length === 0) return `${expr.typeName} {}`;
  const fields = expr.fields.map(
    (f) => `${f.name}: ${fmtExpr(f.value, depth)}`,
  );
  const inline = `${expr.typeName} { ${fields.join(", ")} }`;
  if (inline.length <= 60) return inline;
  const ind = INDENT.repeat(depth + 1);
  return `${expr.typeName} {\n${fields.map((f) => ind + f).join(",\n")}\n${INDENT.repeat(depth)}}`;
}

// ─── Stream / emit helpers ────────────────────────────────────────────────────

function fmtStreamRef(ref: AST.StreamRef): string {
  return ref.isDynamic ? `@${ref.name}` : `@"${ref.name}"`;
}

function fmtStreamEmit(emit: AST.StreamEmit): string {
  const op = emit.isRedirect ? "@>" : "@";
  const streams = emit.streams.map(fmtStreamRef).join(", ");
  const term = emit.terminates ? "XX" : "";
  return `${op}${streams}${term}`;
}

function fmtOutcomeMatch(om: AST.OutcomeMatch, depth: number): string {
  const handler = fmtExpr(om.handler, depth);
  const emit = om.streamEmit ? ` ${fmtStreamEmit(om.streamEmit)}` : "";
  return `.${om.tag.name} ${handler}${emit}`;
}

// ─── Declaration formatting ───────────────────────────────────────────────────

function fmtImport(decl: AST.ImportDeclaration): string {
  let path = decl.modulePath;
  // If path has no sigil chars, emit bare; if it's a file path add quotes
  if (path.includes("/") || path.includes(".")) {
    path = `"${path}"`;
  }
  let base = `i:${path}`;
  if (decl.imports && decl.imports.length > 0) {
    base += ` (${decl.imports.join(", ")})`;
  }
  if (decl.alias) {
    base += ` as ${decl.alias}`;
  }
  return base;
}

function fmtFunction(decl: AST.FunctionDeclaration): string {
  const prefix = decl.isRecursive ? "rec " : "";
  const params = decl.params.length > 0 ? ` ${decl.params.join(" ")}` : "";
  const contract =
    decl.emissionContract && decl.emissionContract.length > 0
      ? ` ~> ${decl.emissionContract.map((s) => `@"${s}"`).join(", ")}`
      : "";
  const head = `${prefix}f:${decl.name}${params}${contract}`;

  if (decl.body.type === "IndentedBody") {
    const stmts = decl.body.statements
      .map((s) =>
        s.type === "BindingDeclaration"
          ? `${INDENT}${fmtBinding(s)}`
          : `${INDENT}${fmtExpr(s, 1)}`,
      )
      .join("\n");
    return `${head} =>\n${stmts}`;
  }

  const bodyStr = fmtExpr(decl.body, 0);
  return `${head} => ${bodyStr}`;
}

function fmtBinding(decl: AST.BindingDeclaration): string {
  const value = fmtExpr(decl.value, 0);
  if (decl.hasExplicitSigil) return `b: :${decl.name} ${value}`;
  return `:${decl.name} ${value}`;
}

function fmtStruct(decl: AST.StructDeclaration): string {
  if (decl.fields.length === 0) return `s:${decl.name} {}`;
  const fields = decl.fields.map((f) => `${INDENT}${f.name}: ${f.typeName}`);
  return `s:${decl.name} {\n${fields.join("\n")}\n}`;
}

function fmtDeclaration(decl: AST.Declaration): string {
  switch (decl.type) {
    case "FunctionDeclaration":
      return fmtFunction(decl);
    case "BindingDeclaration":
      return fmtBinding(decl);
    case "StructDeclaration":
      return fmtStruct(decl);
  }
}

function fmtSource(decl: AST.SourceDeclaration): string {
  return `src: ${fmtStreamRef(decl.stream)} ${fmtExpr(decl.source, 0)}`;
}

function fmtSink(decl: AST.SinkDeclaration): string {
  return `to: ${fmtStreamRef(decl.stream)} ${fmtExpr(decl.sink, 0)}`;
}

function fmtOnHandler(h: AST.OnHandler): string {
  const pattern = `@"${h.streamPattern}"`;
  const handler = fmtLambda(h.handler, 0);
  const emit = h.streamEmit ? ` ${fmtStreamEmit(h.streamEmit)}` : "";
  return `on ${pattern} |> ${handler}${emit}`;
}

function fmtRoute(decl: AST.RouteDeclaration): string {
  const stream = fmtStreamRef(decl.streamPattern);
  const pipeline = fmtExpr(decl.pipeline, 0);
  return `route ${stream} |> ${pipeline}`;
}

function fmtContingency(c: AST.Contingency): string {
  switch (c.type) {
    case "OnHandler":
      return fmtOnHandler(c);
    case "RouteDeclaration":
      return fmtRoute(c);
    case "OutcomeMatch":
      return fmtOutcomeMatch(c, 0);
  }
}

function fmtTest(decl: AST.TestDeclaration): string {
  const stmts = decl.body.statements
    .map((s) =>
      s.type === "BindingDeclaration"
        ? `${INDENT}${fmtBinding(s)}`
        : `${INDENT}${fmtExpr(s, 1)}`,
    )
    .join("\n");
  return `test "${decl.label}"\n${stmts}`;
}

function fmtRuntime(decl: AST.RuntimeDeclaration): string {
  if (decl.type === "RunForeverDeclaration") return "run forever";
  switch (decl.condition.type) {
    case "SignalCondition":
      return "run until signal";
    case "StreamCondition":
      return `run until ${fmtStreamRef(decl.condition.stream)}`;
    case "TimeoutCondition":
      return `run until timeout(${fmtExpr(decl.condition.duration, 0)})`;
  }
}

// ─── Module formatting ────────────────────────────────────────────────────────

export function format(module: AST.Module): string {
  const sections: string[] = [];

  if (module.imports.length > 0) {
    sections.push(module.imports.map(fmtImport).join("\n"));
  }

  if (module.sourceDeclarations.length > 0) {
    sections.push(module.sourceDeclarations.map(fmtSource).join("\n"));
  }

  if (module.definitions.length > 0) {
    sections.push(module.definitions.map(fmtDeclaration).join("\n\n"));
  }

  if (module.testDeclarations.length > 0) {
    sections.push(module.testDeclarations.map(fmtTest).join("\n\n"));
  }

  if (module.contingencies.length > 0) {
    sections.push(module.contingencies.map(fmtContingency).join("\n"));
  }

  if (module.primaryExpressions.length > 0) {
    sections.push(
      module.primaryExpressions.map((e) => fmtExpr(e, 0)).join("\n"),
    );
  }

  if (module.sinkDeclarations.length > 0) {
    sections.push(module.sinkDeclarations.map(fmtSink).join("\n"));
  }

  if (module.runtimeDeclaration) {
    sections.push(fmtRuntime(module.runtimeDeclaration));
  }

  return sections.join("\n\n") + (sections.length > 0 ? "\n" : "");
}
