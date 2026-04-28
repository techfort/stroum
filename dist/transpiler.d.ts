import * as AST from './ast';
export declare class Transpiler {
    private indent;
    private output;
    private stdlibPath;
    constructor(stdlibPath?: string);
    transpile(module: AST.Module, currentFilePath?: string): string;
    private transpileImport;
    private transpileStructDeclaration;
    private transpileFunctionDeclaration;
    private transpileBindingDeclaration;
    private transpileIndentedBody;
    private transpileExpression;
    private transpileListLiteral;
    private transpileRecordLiteral;
    private transpileCallExpression;
    private transpilePipeExpression;
    private transpileParallelExpression;
    private transpilePipeChainWithInitialValue;
    private transpilePipeStage;
    private streamRefToTs;
    private transpileLambda;
    private transpileTaggedExpression;
    private tagRefToTs;
    private transpileOutcomeHandler;
    private transpileIfExpression;
    private transpileOutcomeMatchInline;
    private transpileOnHandler;
    private transpileRouteDeclaration;
    private mapTypeName;
    private emit;
    static emitRuntime(outputDir: string): void;
}
//# sourceMappingURL=transpiler.d.ts.map