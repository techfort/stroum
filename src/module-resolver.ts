import * as fs from 'fs';
import * as path from 'path';
import { Lexer } from './lexer';
import { Parser } from './parser';
import * as AST from './ast';

export interface ResolvedModule {
  filePath: string;
  module: AST.Module;
  dependencies: string[]; // Paths to imported modules
}

export class ModuleResolver {
  private moduleCache: Map<string, ResolvedModule> = new Map();
  private resolvingStack: Set<string> = new Set(); // Track modules currently being resolved (for circular detection)
  private stdlibPath: string;

  constructor(stdlibPath?: string) {
    // Default stdlib path relative to this file
    this.stdlibPath = stdlibPath || path.join(__dirname, '../stdlib');
  }

  /**
   * Resolve a module path to an absolute file path
   */
  resolveModulePath(modulePath: string, fromFile: string): string {
    // If it's a file path (starts with ./ or ../ or is absolute), resolve relative to fromFile
    if (modulePath.startsWith('./') || modulePath.startsWith('../') || path.isAbsolute(modulePath)) {
      const fromDir = path.dirname(fromFile);
      const resolved = path.resolve(fromDir, modulePath);
      
      // Add .stm extension if not present
      if (!resolved.endsWith('.stm')) {
        return resolved + '.stm';
      }
      return resolved;
    }

    // Otherwise, it's a stdlib module name (e.g., "core")
    const stdlibFile = path.join(this.stdlibPath, `${modulePath}.stm`);
    
    if (fs.existsSync(stdlibFile)) {
      return stdlibFile;
    }

    // If not found, try as-is (might be a custom module in search path)
    if (fs.existsSync(modulePath)) {
      return modulePath;
    }

    throw new Error(
      `[stroum] Module resolution error: Cannot find module "${modulePath}"\n` +
      `  Searched: ${stdlibFile}\n` +
      `  From: ${fromFile}`
    );
  }

  /**
   * Load and parse a module file
   */
  loadModule(filePath: string): ResolvedModule {
    // Check cache first
    if (this.moduleCache.has(filePath)) {
      return this.moduleCache.get(filePath)!;
    }

    // Check for circular dependencies
    if (this.resolvingStack.has(filePath)) {
      const cycle = Array.from(this.resolvingStack).join(' -> ');
      throw new Error(
        `[stroum] Circular dependency detected:\n` +
        `  ${cycle} -> ${filePath}`
      );
    }

    // Mark as being resolved
    this.resolvingStack.add(filePath);

    try {
      // Read and parse the file
      if (!fs.existsSync(filePath)) {
        throw new Error(`[stroum] Module file not found: ${filePath}`);
      }

      const source = fs.readFileSync(filePath, 'utf-8');
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const module = parser.parse();

      // Collect dependencies (all imported module paths)
      const dependencies: string[] = [];
      for (const importDecl of module.imports) {
        const depPath = this.resolveModulePath(importDecl.modulePath, filePath);
        dependencies.push(depPath);
      }

      const resolved: ResolvedModule = {
        filePath,
        module,
        dependencies
      };

      // Cache it
      this.moduleCache.set(filePath, resolved);

      // Recursively resolve dependencies
      for (const depPath of dependencies) {
        this.loadModule(depPath);
      }

      return resolved;
    } finally {
      // Remove from resolving stack
      this.resolvingStack.delete(filePath);
    }
  }

  /**
   * Get all loaded modules in dependency order (dependencies first)
   */
  getModulesInOrder(): ResolvedModule[] {
    const visited = new Set<string>();
    const result: ResolvedModule[] = [];

    const visit = (filePath: string) => {
      if (visited.has(filePath)) return;
      visited.add(filePath);

      const resolved = this.moduleCache.get(filePath);
      if (!resolved) return;

      // Visit dependencies first
      for (const depPath of resolved.dependencies) {
        visit(depPath);
      }

      result.push(resolved);
    };

    // Visit all cached modules
    for (const filePath of this.moduleCache.keys()) {
      visit(filePath);
    }

    return result;
  }

  /**
   * Clear the module cache
   */
  clearCache(): void {
    this.moduleCache.clear();
    this.resolvingStack.clear();
  }

  /**
   * Get a cached module
   */
  getCachedModule(filePath: string): ResolvedModule | undefined {
    return this.moduleCache.get(filePath);
  }
}
