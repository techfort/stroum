import * as fs from 'fs';
import * as path from 'path';
import { Lexer } from './lexer';
import { Parser } from './parser';
import * as AST from './ast';

export interface FunctionSignature {
  name: string;
  arity: number; // Number of parameters
  isRecursive: boolean;
}

export class StdlibLoader {
  private stdlibPath: string;
  private functions: Map<string, FunctionSignature> = new Map();

  constructor(stdlibPath?: string) {
    // Default stdlib path relative to this file
    this.stdlibPath = stdlibPath || path.join(__dirname, '../stdlib');
    this.loadCore();
  }

  /**
   * Load the core stdlib module
   */
  private loadCore(): void {
    const corePath = path.join(this.stdlibPath, 'core.stm');
    
    if (!fs.existsSync(corePath)) {
      // Stdlib not found - this is okay for development, but warn
      console.warn(`[stroum] Warning: stdlib/core.stm not found at ${corePath}`);
      return;
    }

    try {
      const source = fs.readFileSync(corePath, 'utf-8');
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const module = parser.parse();

      // Extract all function declarations
      for (const decl of module.definitions) {
        if (decl.type === 'FunctionDeclaration') {
          const funcDecl = decl as AST.FunctionDeclaration;
          this.functions.set(funcDecl.name, {
            name: funcDecl.name,
            arity: funcDecl.params.length,
            isRecursive: funcDecl.isRecursive
          });
        }
      }
    } catch (error) {
      // Failed to parse stdlib - warn but continue
      console.warn(`[stroum] Warning: Failed to parse stdlib/core.stm: ${error}`);
    }
  }

  /**
   * Check if a function is in the stdlib
   */
  hasFunction(name: string): boolean {
    return this.functions.has(name);
  }

  /**
   * Get a function signature from stdlib
   */
  getFunction(name: string): FunctionSignature | undefined {
    return this.functions.get(name);
  }

  /**
   * Get all stdlib function names
   */
  getAllFunctions(): string[] {
    return Array.from(this.functions.keys());
  }

  /**
   * Get all function signatures
   */
  getAllSignatures(): FunctionSignature[] {
    return Array.from(this.functions.values());
  }
}
