import * as AST from './ast';
export interface ResolvedModule {
    filePath: string;
    module: AST.Module;
    dependencies: string[];
}
export declare class ModuleResolver {
    private moduleCache;
    private resolvingStack;
    private stdlibPath;
    constructor(stdlibPath?: string);
    /**
     * Resolve a module path to an absolute file path
     */
    resolveModulePath(modulePath: string, fromFile: string): string;
    /**
     * Load and parse a module file
     */
    loadModule(filePath: string): ResolvedModule;
    /**
     * Get all loaded modules in dependency order (dependencies first)
     */
    getModulesInOrder(): ResolvedModule[];
    /**
     * Clear the module cache
     */
    clearCache(): void;
    /**
     * Get a cached module
     */
    getCachedModule(filePath: string): ResolvedModule | undefined;
}
//# sourceMappingURL=module-resolver.d.ts.map