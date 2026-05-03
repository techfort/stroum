import * as AST from './ast';

// ─── Exported graph types (shared with webview via type imports) ─────────────

export interface DataflowGraph {
  nodes: DFNode[];
  edges: DFEdge[];
}

export type DFNodeKind = 'function' | 'binding' | 'stream' | 'tag' | 'fork';

export interface DFNode {
  id: string;
  kind: DFNodeKind;
  label: string;
  params?: string[];
  isExternal?: boolean; // stdlib or unrecognised callee
}

export type DFEdgeKind = 'pipe' | 'call' | 'emit' | 'handler' | 'parallel' | 'outcome';

export interface DFEdge {
  id: string;
  from: string;
  to: string;
  kind: DFEdgeKind;
  label?: string;
}

// ─── Analyser ────────────────────────────────────────────────────────────────

export function analyzeDataflow(module: AST.Module): DataflowGraph {
  const nodes = new Map<string, DFNode>();
  const edges: DFEdge[] = [];
  const edgeDedup = new Set<string>();
  let counter = 0;

  // ── helpers ───────────────────────────────────────────────────────────────

  function addNode(node: DFNode): void {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  }

  function addEdge(from: string, to: string, kind: DFEdgeKind, label?: string): void {
    if (!from || !to || from === to) return;
    const key = `${from}|${kind}|${to}`;
    if (edgeDedup.has(key)) return;
    edgeDedup.add(key);
    edges.push({ id: `e${counter++}`, from, to, kind, label });
  }

  // Resolve an expression to its primary node ID.
  // Returns null when the expression has no natural node (e.g. a literal, a param).
  function resolveId(expr: AST.Expression): string | null {
    if (expr.type === 'Identifier') {
      if (nodes.has(`fn:${expr.name}`)) return `fn:${expr.name}`;
      if (nodes.has(`bind:${expr.name}`)) return `bind:${expr.name}`;
      return null; // param or unresolvable
    }
    if (expr.type === 'CallExpression') {
      // Create an external node on demand for callees not already declared
      const id = `fn:${expr.callee}`;
      if (!nodes.has(id)) {
        nodes.set(id, { id, kind: 'function', label: expr.callee, isExternal: true });
      }
      return id;
    }
    return null;
  }

  // ── Pass 1: collect declared nodes ────────────────────────────────────────

  for (const def of module.definitions) {
    if (def.type === 'FunctionDeclaration') {
      addNode({ id: `fn:${def.name}`, kind: 'function', label: def.name, params: def.params });
    } else if (def.type === 'BindingDeclaration') {
      addNode({ id: `bind:${def.name}`, kind: 'binding', label: def.name });
    }
  }

  // Recursively scan all expressions for stream and tag names
  function scanNodes(expr: AST.Expression | AST.IndentedBody | null | undefined): void {
    if (!expr) return;

    if (expr.type === 'IndentedBody') {
      for (const s of expr.statements) {
        if (s.type === 'BindingDeclaration') scanNodes(s.value);
        else scanNodes(s as AST.Expression);
      }
      return;
    }

    switch (expr.type) {
      case 'PipeExpression':
        for (const s of expr.stages) scanNodes(s);
        if (expr.streamEmit) {
          for (const sr of expr.streamEmit.streams) {
            if (!sr.isDynamic) addNode({ id: `stream:${sr.name}`, kind: 'stream', label: `@"${sr.name}"` });
          }
        }
        for (const om of expr.outcomeMatches) {
          addNode({ id: `tag:${om.tag.name}`, kind: 'tag', label: `.${om.tag.name}` });
          scanNodes(om.handler);
          if (om.streamEmit) {
            for (const sr of om.streamEmit.streams) {
              if (!sr.isDynamic) addNode({ id: `stream:${sr.name}`, kind: 'stream', label: `@"${sr.name}"` });
            }
          }
        }
        break;

      case 'ParallelExpression':
        for (const b of expr.branches) scanNodes(b);
        if (expr.gatherPipe.streamEmit) {
          for (const sr of expr.gatherPipe.streamEmit.streams) {
            if (!sr.isDynamic) addNode({ id: `stream:${sr.name}`, kind: 'stream', label: `@"${sr.name}"` });
          }
        }
        scanNodes(expr.gatherPipe.target);
        break;

      case 'CallExpression':
        for (const a of expr.args) scanNodes(a);
        break;

      case 'Lambda':
        scanNodes(expr.body);
        break;

      case 'IfExpression':
        scanNodes(expr.condition);
        scanNodes(expr.thenBranch);
        scanNodes(expr.elseBranch);
        break;

      case 'TaggedExpression':
        addNode({ id: `tag:${expr.tag.name}`, kind: 'tag', label: `.${expr.tag.name}` });
        scanNodes(expr.value);
        break;

      case 'InterpolatedStringLiteral':
        for (const seg of expr.segments) {
          if (seg.kind === 'expr') scanNodes(seg.expression);
        }
        break;

      case 'ListLiteral':
        for (const el of expr.elements) scanNodes(el);
        break;

      case 'RecordLiteral':
        for (const f of expr.fields) scanNodes(f.value);
        break;
    }
  }

  for (const def of module.definitions) {
    if (def.type === 'FunctionDeclaration') scanNodes(def.body);
    else if (def.type === 'BindingDeclaration') scanNodes(def.value);
  }
  for (const expr of module.primaryExpressions) scanNodes(expr);
  for (const cont of module.contingencies) {
    if (cont.type === 'OnHandler') {
      addNode({ id: `stream:${cont.streamPattern}`, kind: 'stream', label: `@"${cont.streamPattern}"` });
      if (cont.streamEmit) {
        for (const sr of cont.streamEmit.streams) {
          if (!sr.isDynamic) addNode({ id: `stream:${sr.name}`, kind: 'stream', label: `@"${sr.name}"` });
        }
      }
    } else if (cont.type === 'RouteDeclaration') {
      if (!cont.streamPattern.isDynamic) {
        addNode({ id: `stream:${cont.streamPattern.name}`, kind: 'stream', label: `@"${cont.streamPattern.name}"` });
      }
      scanNodes(cont.pipeline);
    } else if (cont.type === 'OutcomeMatch') {
      addNode({ id: `tag:${cont.tag.name}`, kind: 'tag', label: `.${cont.tag.name}` });
      scanNodes(cont.handler);
      if (cont.streamEmit) {
        for (const sr of cont.streamEmit.streams) {
          if (!sr.isDynamic) addNode({ id: `stream:${sr.name}`, kind: 'stream', label: `@"${sr.name}"` });
        }
      }
    }
  }

  // ── Pass 2: collect edges ─────────────────────────────────────────────────

  // Walk a pipe expression. sourceId is the node "feeding into" this pipe.
  // Returns the last stage's node ID.
  function walkPipe(pipe: AST.PipeExpression, sourceId: string | null): string | null {
    let prevId: string | null = sourceId;

    for (const stage of pipe.stages) {
      const stageId = resolveId(stage);
      if (stageId) {
        if (prevId && prevId !== stageId) addEdge(prevId, stageId, 'pipe');
        // Walk args of call expressions for nested call-edges
        if (stage.type === 'CallExpression') {
          walkArgs(stage.args, stageId);
        }
        prevId = stageId;
      } else {
        // Literal, param, lambda — stay on prevId and walk children
        walkExprChildren(stage, prevId);
      }
    }

    if (pipe.streamEmit) {
      for (const sr of pipe.streamEmit.streams) {
        if (!sr.isDynamic && prevId) addEdge(prevId, `stream:${sr.name}`, 'emit');
      }
    }
    for (const om of pipe.outcomeMatches) {
      const tagId = `tag:${om.tag.name}`;
      if (prevId) addEdge(prevId, tagId, 'outcome');
      walkExpr(om.handler, tagId);
    }

    return prevId;
  }

  // Walk an expression with a known source context node.
  // Returns the "output" node ID of the expression (may equal sourceId if no natural output).
  function walkExpr(expr: AST.Expression | AST.IndentedBody | null | undefined, sourceId: string | null): string | null {
    if (!expr) return sourceId;

    if (expr.type === 'IndentedBody') {
      let cur = sourceId;
      for (const stmt of expr.statements) {
        if (stmt.type === 'BindingDeclaration') {
          cur = walkExpr(stmt.value, cur);
        } else {
          cur = walkExpr(stmt as AST.Expression, cur);
        }
      }
      return cur;
    }

    switch (expr.type) {
      case 'PipeExpression':
        return walkPipe(expr, sourceId);

      case 'ParallelExpression': {
        const forkId = `fork:${counter++}`;
        addNode({ id: forkId, kind: 'fork', label: 'PP' });
        if (sourceId) addEdge(sourceId, forkId, 'parallel');

        const branchEnds: string[] = [];
        for (const branch of expr.branches) {
          const end = walkPipe(branch, forkId);
          if (end) branchEnds.push(end);
        }

        const gatherId = resolveId(expr.gatherPipe.target);
        const gatherTarget = gatherId ?? forkId;
        for (const end of branchEnds) {
          if (end !== gatherTarget) addEdge(end, gatherTarget, 'parallel');
        }
        if (expr.gatherPipe.target.type === 'CallExpression') {
          walkArgs((expr.gatherPipe.target as AST.CallExpression).args, gatherTarget);
        }
        if (expr.gatherPipe.streamEmit) {
          for (const sr of expr.gatherPipe.streamEmit.streams) {
            if (!sr.isDynamic) addEdge(gatherTarget, `stream:${sr.name}`, 'emit');
          }
        }
        return gatherTarget;
      }

      case 'CallExpression': {
        const calleeId = `fn:${expr.callee}`;
        if (!nodes.has(calleeId)) {
          nodes.set(calleeId, { id: calleeId, kind: 'function', label: expr.callee, isExternal: true });
        }
        if (sourceId && sourceId !== calleeId) {
          addEdge(sourceId, calleeId, 'call');
        }
        walkArgs(expr.args, calleeId);
        return calleeId;
      }

      case 'Lambda':
        return walkExpr(expr.body, sourceId);

      case 'IfExpression':
        walkExprChildren(expr.condition, sourceId);
        walkExpr(expr.thenBranch, sourceId);
        walkExpr(expr.elseBranch, sourceId);
        return sourceId;

      case 'TaggedExpression': {
        const tagId = `tag:${expr.tag.name}`;
        if (sourceId) addEdge(sourceId, tagId, 'outcome');
        walkExprChildren(expr.value, tagId);
        return tagId;
      }

      default:
        walkExprChildren(expr, sourceId);
        return sourceId;
    }
  }

  // Walk call args — only emit call edges for user-defined function identifiers
  function walkArgs(args: AST.Expression[], sourceId: string | null): void {
    for (const arg of args) {
      if (arg.type === 'Identifier' && nodes.has(`fn:${arg.name}`) && !(nodes.get(`fn:${arg.name}`)?.isExternal)) {
        if (sourceId) addEdge(sourceId, `fn:${arg.name}`, 'call');
      } else if (arg.type === 'Lambda') {
        walkExpr(arg.body, sourceId);
      } else {
        walkExprChildren(arg, sourceId);
      }
    }
  }

  // Walk sub-expressions without changing the sourceId
  function walkExprChildren(expr: AST.Expression | null | undefined, sourceId: string | null): void {
    if (!expr) return;
    switch (expr.type) {
      case 'PipeExpression':
      case 'ParallelExpression':
      case 'CallExpression':
      case 'Lambda':
      case 'IfExpression':
      case 'TaggedExpression':
        walkExpr(expr, sourceId);
        break;
      case 'InterpolatedStringLiteral':
        for (const seg of expr.segments) {
          if (seg.kind === 'expr') walkExprChildren(seg.expression, sourceId);
        }
        break;
      case 'ListLiteral':
        for (const el of expr.elements) walkExprChildren(el, sourceId);
        break;
      case 'RecordLiteral':
        for (const f of expr.fields) walkExprChildren(f.value, sourceId);
        break;
    }
  }

  // Walk declarations
  for (const def of module.definitions) {
    if (def.type === 'FunctionDeclaration') {
      walkExpr(def.body, `fn:${def.name}`);
    } else if (def.type === 'BindingDeclaration') {
      walkExpr(def.value, `bind:${def.name}`);
    }
  }

  // Walk primary (top-level) expressions — start from the first resolvable node
  for (const expr of module.primaryExpressions) {
    if (expr.type === 'PipeExpression' && expr.stages.length > 0) {
      const firstId = resolveId(expr.stages[0]);
      if (firstId) {
        walkPipe({ ...expr, stages: expr.stages.slice(1) } as AST.PipeExpression, firstId);
      } else {
        walkPipe(expr, null);
      }
    } else {
      const id = resolveId(expr);
      walkExpr(expr, id);
    }
  }

  // Walk contingencies
  for (const cont of module.contingencies) {
    if (cont.type === 'OnHandler') {
      const streamId = `stream:${cont.streamPattern}`;
      walkExpr(cont.handler.body, streamId);
      if (cont.streamEmit) {
        for (const sr of cont.streamEmit.streams) {
          if (!sr.isDynamic) addEdge(streamId, `stream:${sr.name}`, 'handler');
        }
      }
    } else if (cont.type === 'RouteDeclaration') {
      const streamId = `stream:${cont.streamPattern.name}`;
      walkExpr(cont.pipeline, streamId);
    } else if (cont.type === 'OutcomeMatch') {
      const tagId = `tag:${cont.tag.name}`;
      walkExpr(cont.handler, tagId);
      if (cont.streamEmit) {
        for (const sr of cont.streamEmit.streams) {
          if (!sr.isDynamic) addEdge(tagId, `stream:${sr.name}`, 'emit');
        }
      }
    }
  }

  return { nodes: Array.from(nodes.values()), edges };
}
