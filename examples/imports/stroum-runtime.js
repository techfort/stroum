"use strict";
// Stroum Runtime Support
// This file is emitted alongside transpiled code to provide stream handling utilities
Object.defineProperty(exports, "__esModule", { value: true });
exports.__router = exports.StreamRouter = void 0;
exports.__route = __route;
exports.__matchOutcome = __matchOutcome;
exports.__partialPipe = __partialPipe;
class StreamRouter {
    constructor() {
        this.handlers = new Map();
        this.traceHandler = null;
    }
    // Emit a value to a named stream
    emit(streamName, value) {
        const handlers = this.handlers.get(streamName);
        if (handlers) {
            for (const handler of handlers) {
                handler(value);
            }
        }
        // Always emit to __trace stream for debugging
        if (this.traceHandler && streamName !== '__trace') {
            this.traceHandler({ stream: streamName, value });
        }
    }
    // Register an on-handler for a stream
    on(streamName, handler) {
        if (streamName === '__trace') {
            this.traceHandler = handler;
        }
        else {
            if (!this.handlers.has(streamName)) {
                this.handlers.set(streamName, []);
            }
            this.handlers.get(streamName).push(handler);
        }
    }
    // Execute registered handlers at the end of the program
    async executeHandlers() {
        // Handlers are executed as values are emitted during program execution
        // This method is called at the end to ensure all handlers have run
    }
}
exports.StreamRouter = StreamRouter;
// Global stream router instance
exports.__router = new StreamRouter();
// Helper to route a value to either a stream or return it
function __route(value, streamName) {
    if (streamName) {
        exports.__router.emit(streamName, value);
        return undefined; // Stream emit doesn't return a value
    }
    return value;
}
// Helper for outcome matching
function __matchOutcome(value, outcomeName, handler) {
    // In a real implementation, this would check if the value has an outcome field
    // For now, we assume values have shape { outcome: string, value: any }
    if (typeof value === 'object' && value !== null && value.outcome === outcomeName) {
        return handler();
    }
    return value;
}
// Helper for partial pipes (|?>)
function __partialPipe(value, fn) {
    if (value === null || value === undefined) {
        return value;
    }
    return fn(value);
}
