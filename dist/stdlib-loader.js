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
exports.StdlibLoader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
class StdlibLoader {
    constructor(stdlibPath) {
        this.functions = new Map();
        // Default stdlib path relative to this file
        this.stdlibPath = stdlibPath || path.join(__dirname, '../stdlib');
        this.loadCore();
    }
    /**
     * Load the core stdlib module
     */
    loadCore() {
        const corePath = path.join(this.stdlibPath, 'core.stm');
        if (!fs.existsSync(corePath)) {
            // Stdlib not found - this is okay for development, but warn
            console.warn(`[stroum] Warning: stdlib/core.stm not found at ${corePath}`);
            return;
        }
        try {
            const source = fs.readFileSync(corePath, 'utf-8');
            const lexer = new lexer_1.Lexer(source);
            const tokens = lexer.tokenize();
            const parser = new parser_1.Parser(tokens);
            const module = parser.parse();
            // Extract all function declarations
            for (const decl of module.definitions) {
                if (decl.type === 'FunctionDeclaration') {
                    const funcDecl = decl;
                    this.functions.set(funcDecl.name, {
                        name: funcDecl.name,
                        arity: funcDecl.params.length,
                        isRecursive: funcDecl.isRecursive
                    });
                }
            }
        }
        catch (error) {
            // Failed to parse stdlib - warn but continue
            console.warn(`[stroum] Warning: Failed to parse stdlib/core.stm: ${error}`);
        }
    }
    /**
     * Check if a function is in the stdlib
     */
    hasFunction(name) {
        return this.functions.has(name);
    }
    /**
     * Get a function signature from stdlib
     */
    getFunction(name) {
        return this.functions.get(name);
    }
    /**
     * Get all stdlib function names
     */
    getAllFunctions() {
        return Array.from(this.functions.keys());
    }
    /**
     * Get all function signatures
     */
    getAllSignatures() {
        return Array.from(this.functions.values());
    }
}
exports.StdlibLoader = StdlibLoader;
//# sourceMappingURL=stdlib-loader.js.map