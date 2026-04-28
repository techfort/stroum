import * as AST from './ast';
import { SourceLocation } from './types';
export interface ValidationError {
    type: 'error';
    message: string;
    location: SourceLocation;
}
export interface ValidationWarning {
    type: 'warning';
    message: string;
    location: SourceLocation;
}
export type ValidationIssue = ValidationError | ValidationWarning;
export declare class Validator {
    private errors;
    private warnings;
    private moduleBindings;
    private currentScope;
    private currentFunctionName;
    private stdlibLoader;
    private moduleResolver;
    private imports;
    private currentFilePath;
    constructor(stdlibPath?: string);
    validate(module: AST.Module, filePath?: string): ValidationIssue[];
    private processImport;
    private isFunctionAvailable;
    private isQualifiedFunctionAvailable;
    private addModuleBinding;
    private addError;
    private addWarning;
    private validateDefinition;
    private validateFunctionDeclaration;
    private validateBindingDeclaration;
    private validateStructDeclaration;
    private validateBody;
    private validateExpression;
    private validateLambda;
    private validateOutcomeMatch;
    private validateContingency;
    private validateRouteDeclaration;
    private validateRoutePipeline;
    private validateOnHandler;
    private checkForSelfReference;
    private checkForSelfReferenceExpr;
    private countOutcomePaths;
    private countOutcomePathsExpr;
    private collectIdentifiers;
    private isStringLiteral;
}
//# sourceMappingURL=validator.d.ts.map