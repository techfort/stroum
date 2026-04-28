export interface FunctionSignature {
    name: string;
    arity: number;
    isRecursive: boolean;
}
export declare class StdlibLoader {
    private stdlibPath;
    private functions;
    constructor(stdlibPath?: string);
    /**
     * Load the core stdlib module
     */
    private loadCore;
    /**
     * Check if a function is in the stdlib
     */
    hasFunction(name: string): boolean;
    /**
     * Get a function signature from stdlib
     */
    getFunction(name: string): FunctionSignature | undefined;
    /**
     * Get all stdlib function names
     */
    getAllFunctions(): string[];
    /**
     * Get all function signatures
     */
    getAllSignatures(): FunctionSignature[];
}
//# sourceMappingURL=stdlib-loader.d.ts.map