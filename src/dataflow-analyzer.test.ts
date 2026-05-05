import * as fs from 'fs';
import * as path from 'path';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { analyzeDataflow, DataflowGraph } from './dataflow-analyzer';

function analyze(source: string): DataflowGraph {
  const tokens = new Lexer(source).tokenize();
  const ast = new Parser(tokens).parse();
  return analyzeDataflow(ast);
}

function nodeIds(g: DataflowGraph): string[] {
  return g.nodes.map(n => n.id).sort();
}

function hasEdge(g: DataflowGraph, from: string, to: string, kind: string): boolean {
  return g.edges.some(e => e.from === from && e.to === to && e.kind === kind);
}

describe('analyzeDataflow', () => {
  describe('node collection', () => {
    it('creates a function node for f: declarations', () => {
      const g = analyze('f:my_fn x => x');
      expect(g.nodes.find(n => n.id === 'fn:my_fn')).toMatchObject({
        id: 'fn:my_fn',
        kind: 'function',
        label: 'my_fn',
        params: ['x'],
      });
    });

    it('creates a binding node for : declarations', () => {
      const g = analyze(':answer 42');
      expect(g.nodes.find(n => n.id === 'bind:answer')).toMatchObject({
        id: 'bind:answer',
        kind: 'binding',
        label: 'answer',
      });
    });

    it('creates a stream node for @ emit inside a function', () => {
      const g = analyze('f:emit x => x @ "events"');
      expect(g.nodes.find(n => n.id === 'stream:events')).toMatchObject({
        id: 'stream:events',
        kind: 'stream',
        label: '@"events"',
      });
    });

    it('creates a tag node for tagged expressions', () => {
      const g = analyze('f:wrap x => .my_tag x');
      expect(g.nodes.find(n => n.id === 'tag:my_tag')).toMatchObject({
        id: 'tag:my_tag',
        kind: 'tag',
        label: '.my_tag',
      });
    });

    it('creates a stream node from on handler', () => {
      const g = analyze('f:noop x => x\non @"updates" |> |:v| => noop(v)');
      expect(g.nodes.find(n => n.id === 'stream:updates')).toBeTruthy();
    });

    it('creates a stream node from route declaration', () => {
      const g = analyze('f:process x => x\nroute @"raw" |> process');
      expect(g.nodes.find(n => n.id === 'stream:raw')).toBeTruthy();
    });

    it('marks unknown callees as external', () => {
      const g = analyze('f:my_fn x => println(x)');
      const node = g.nodes.find(n => n.id === 'fn:println');
      expect(node).toBeTruthy();
      expect(node?.isExternal).toBe(true);
    });

    it('does not mark declared functions as external', () => {
      const g = analyze('f:helper x => x\nf:main x => helper(x)');
      const node = g.nodes.find(n => n.id === 'fn:helper');
      expect(node?.isExternal).toBeFalsy();
    });
  });

  describe('edge collection', () => {
    it('adds a pipe edge between consecutive pipe stages', () => {
      const g = analyze('f:double x => x\nf:inc x => x\ndouble |> inc');
      expect(hasEdge(g, 'fn:double', 'fn:inc', 'pipe')).toBe(true);
    });

    it('adds an emit edge from function to stream', () => {
      const g = analyze('f:emit x => x @ "out"');
      expect(hasEdge(g, 'fn:emit', 'stream:out', 'emit')).toBe(true);
    });

    it('adds a pipe edge from stream to function via route', () => {
      const g = analyze('f:process x => x\nroute @"raw" |> process');
      expect(hasEdge(g, 'stream:raw', 'fn:process', 'pipe')).toBe(true);
    });

    it('adds a pipe edge from identifier handler in outcome match', () => {
      // .tag => fn_handler should create tag -> fn_handler pipe edge
      const g = analyze('f:handler x => x\nf:classify x =>\n  x\n  | .done => handler');
      expect(hasEdge(g, 'tag:done', 'fn:handler', 'pipe')).toBe(true);
    });

    it('adds an outcome edge for tagged expression inside pipe', () => {
      const g = analyze('f:classify x =>\n  x\n  | .high => x @ "alerts"\n  | .low  => x @ "logs"');
      expect(hasEdge(g, 'fn:classify', 'tag:high', 'outcome')).toBe(true);
      expect(hasEdge(g, 'fn:classify', 'tag:low', 'outcome')).toBe(true);
    });

    it('deduplicates identical edges', () => {
      const g = analyze('f:helper x => x\nf:main x => helper(helper(x))');
      const edges = g.edges.filter(e => e.from === 'fn:main' && e.to === 'fn:helper');
      expect(edges.length).toBeLessThanOrEqual(1);
    });

    it('adds a call edge when a user-defined function is passed as argument', () => {
      const g = analyze('f:transform x => x\nf:apply fn => fn(1)\napply(transform)');
      expect(hasEdge(g, 'fn:apply', 'fn:transform', 'call')).toBe(true);
    });
  });

  describe('parallel expressions', () => {
    it('creates a fork node for PP', () => {
      const g = analyze(
        'f:a x => x\nf:b x => x\nf:gather x => x\na PP b |> gather'
      );
      const fork = g.nodes.find(n => n.kind === 'fork');
      expect(fork).toBeTruthy();
      expect(fork?.label).toBe('PP');
    });

    it('adds parallel edges from fork to branches', () => {
      const g = analyze(
        'f:a x => x\nf:b x => x\nf:gather x => x\na PP b |> gather'
      );
      const fork = g.nodes.find(n => n.kind === 'fork');
      expect(fork).toBeTruthy();
      if (fork) {
        // Fork should feed into both branch functions
        const edgesFromFork = g.edges.filter(e => e.from === fork.id);
        expect(edgesFromFork.length).toBeGreaterThan(0);
      }
    });

    it('connects branch ends to gather target', () => {
      const g = analyze(
        'f:a x => x\nf:b x => x\nf:gather x => x\na PP b |> gather'
      );
      // Branch ends (fn:a, fn:b) should connect to fn:gather
      expect(
        hasEdge(g, 'fn:a', 'fn:gather', 'parallel') ||
        hasEdge(g, 'fn:a', 'fn:gather', 'pipe')
      ).toBe(true);
    });
  });

  describe('real example file', () => {
    const examplePath = path.join(__dirname, '..', 'examples', 'dataflow-graph.stm');

    it('parses dataflow-graph.stm without throwing', () => {
      const source = fs.readFileSync(examplePath, 'utf-8');
      expect(() => analyze(source)).not.toThrow();
    });

    it('produces expected function nodes', () => {
      const source = fs.readFileSync(examplePath, 'utf-8');
      const g = analyze(source);
      const ids = nodeIds(g);
      expect(ids).toContain('fn:emit_temp');
      expect(ids).toContain('fn:emit_pressure');
      expect(ids).toContain('fn:normalize');
      expect(ids).toContain('fn:classify');
      expect(ids).toContain('fn:fwd');
    });

    it('produces expected stream nodes', () => {
      const source = fs.readFileSync(examplePath, 'utf-8');
      const g = analyze(source);
      const ids = nodeIds(g);
      expect(ids).toContain('stream:raw');
      expect(ids).toContain('stream:pipeline');
      expect(ids).toContain('stream:critical');
      expect(ids).toContain('stream:normal');
      expect(ids).toContain('stream:low');
    });

    it('produces emit edges from source functions to @raw', () => {
      const source = fs.readFileSync(examplePath, 'utf-8');
      const g = analyze(source);
      expect(hasEdge(g, 'fn:emit_temp', 'stream:raw', 'emit')).toBe(true);
      expect(hasEdge(g, 'fn:emit_pressure', 'stream:raw', 'emit')).toBe(true);
    });

    it('produces a pipe edge from @raw to normalize', () => {
      const source = fs.readFileSync(examplePath, 'utf-8');
      const g = analyze(source);
      expect(hasEdge(g, 'stream:raw', 'fn:normalize', 'pipe')).toBe(true);
    });

    it('produces outcome edges from normalize to tag nodes', () => {
      const source = fs.readFileSync(examplePath, 'utf-8');
      const g = analyze(source);
      expect(hasEdge(g, 'fn:normalize', 'tag:temp', 'outcome')).toBe(true);
      expect(hasEdge(g, 'fn:normalize', 'tag:pressure', 'outcome')).toBe(true);
    });

    it('produces pipe edges from tag nodes to fwd (via outcome match handlers)', () => {
      const source = fs.readFileSync(examplePath, 'utf-8');
      const g = analyze(source);
      expect(hasEdge(g, 'tag:temp', 'fn:fwd', 'pipe')).toBe(true);
      expect(hasEdge(g, 'tag:pressure', 'fn:fwd', 'pipe')).toBe(true);
    });

    it('produces emit edge from fwd to @pipeline', () => {
      const source = fs.readFileSync(examplePath, 'utf-8');
      const g = analyze(source);
      expect(hasEdge(g, 'fn:fwd', 'stream:pipeline', 'emit')).toBe(true);
    });

    it('produces a pipe edge from @pipeline to classify', () => {
      const source = fs.readFileSync(examplePath, 'utf-8');
      const g = analyze(source);
      expect(hasEdge(g, 'stream:pipeline', 'fn:classify', 'pipe')).toBe(true);
    });

    it('produces emit edges from classify to output streams', () => {
      const source = fs.readFileSync(examplePath, 'utf-8');
      const g = analyze(source);
      expect(hasEdge(g, 'fn:classify', 'stream:critical', 'emit')).toBe(true);
      expect(hasEdge(g, 'fn:classify', 'stream:normal', 'emit')).toBe(true);
      expect(hasEdge(g, 'fn:classify', 'stream:low', 'emit')).toBe(true);
    });
  });
});
