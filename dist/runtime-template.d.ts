export declare class StreamRouter {
    private handlers;
    private traceHandler;
    emit(streamName: string, value: any): Promise<void>;
    on(streamName: string, handler: (value: any) => void | Promise<void>): void;
    executeHandlers(): Promise<void>;
}
export declare const __router: StreamRouter;
export declare function __route(value: any, streamName?: string): Promise<any>;
export declare function __matchOutcome(value: any, outcomeName: string, handler: () => any): any;
export declare function __partialPipe(value: any, fn: (v: any) => any): any;
//# sourceMappingURL=runtime-template.d.ts.map