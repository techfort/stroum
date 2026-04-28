"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleResolver = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
class ModuleResolver {
    constructor(stdlibPath) {
        this.moduleCache = new Map();
        this.resolvingStack = new Set(); // Track modules currently being resolved (for circular detection)
        // Default stdlib path relative to this file
        this.stdlibPath = stdlibPath || path.join(__dirname, '../stdlib');
    }
    /**
     * Resolve a module path to an absolute file path
     */
    resolveModulePath(modulePath, fromFile) {
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
        throw new Error(`[stroum] Module resolution error: Cannot find module "${modulePath}"\n` +
            `  Searched: ${stdlibFile}\n` +
            `  From: ${fromFile}`);
    }
    /**
     * Load and parse a module file
     */
    loadModule(filePath) {
        // Check cache first
        if (this.moduleCache.has(filePath)) {
            return this.moduleCache.get(filePath);
        }
        // Check for circular dependencies
        if (this.resolvingStack.has(filePath)) {
            const cycle = Array.from(this.resolvingStack).join(' -> ');
            throw new Error(`[stroum] Circular dependency detected:\n` +
                `  ${cycle} -> ${filePath}`);
        }
        // Mark as being resolved
        this.resolvingStack.add(filePath);
        try {
            // Read and parse the file
            if (!fs.existsSync(filePath)) {
                throw new Error(`[stroum] Module file not found: ${filePath}`);
            }
            const source = fs.readFileSync(filePath, 'utf-8');
            const lexer = new lexer_1.Lexer(source);
            const tokens = lexer.tokenize();
            const parser = new parser_1.Parser(tokens);
            const module = parser.parse();
            // Collect dependencies (all imported module paths)
            const dependencies = [];
            for (const importDecl of module.imports) {
                const depPath = this.resolveModulePath(importDecl.modulePath, filePath);
                dependencies.push(depPath);
            }
            const resolved = {
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
        }
        finally {
            // Remove from resolving stack
            this.resolvingStack.delete(filePath);
        }
    }
    /**
     * Get all loaded modules in dependency order (dependencies first)
     */
    getModulesInOrder() {
        const visited = new Set();
        const result = [];
        const visit = (filePath) => {
            if (visited.has(filePath))
                return;
            visited.add(filePath);
            const resolved = this.moduleCache.get(filePath);
            if (!resolved)
                return;
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
    clearCache() {
        this.moduleCache.clear();
        this.resolvingStack.clear();
    }
    /**
     * Get a cached module
     */
    getCachedModule(filePath) {
        return this.moduleCache.get(filePath);
    }
}
exports.ModuleResolver = ModuleResolver;
//# sourceMappingURL=module-resolver.js.map