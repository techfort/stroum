// Stroum Runtime Support
// This file is emitted alongside transpiled code to provide stream handling utilities

export class StreamRouter {
  private handlers: Map<string, ((value: any) => void | Promise<void>)[]> = new Map();
  private traceHandler: ((value: any) => void | Promise<void>) | null = null;

  // Emit a value to a named stream — async so handler chains fully resolve before continuing
  async emit(streamName: string, value: any): Promise<void> {
    const handlers = this.handlers.get(streamName);
    if (handlers) {
      for (const handler of handlers) {
        await handler(value);
      }
    }
    
    // Always emit to __trace stream for debugging
    if (this.traceHandler && streamName !== '__trace') {
      await this.traceHandler({ stream: streamName, value });
    }
  }

  // Register an on-handler for a stream
  on(streamName: string, handler: (value: any) => void | Promise<void>): void {
    if (streamName === '__trace') {
      this.traceHandler = handler;
    } else {
      if (!this.handlers.has(streamName)) {
        this.handlers.set(streamName, []);
      }
      this.handlers.get(streamName)!.push(handler);
    }
  }

  // Execute registered handlers at the end of the program
  async executeHandlers(): Promise<void> {
    // Handlers are executed as values are emitted during program execution
    // This method is called at the end to ensure all handlers have run
  }
}

// Global stream router instance
export const __router = new StreamRouter();

// Helper to route a value to either a stream or return it
export async function __route(value: any, streamName?: string): Promise<any> {
  if (streamName) {
    await __router.emit(streamName, value);
    return undefined; // Stream emit doesn't return a value
  }
  return value;
}

// Helper for outcome matching
export function __matchOutcome(value: any, outcomeName: string, handler: () => any): any {
  // In a real implementation, this would check if the value has an outcome field
  // For now, we assume values have shape { outcome: string, value: any }
  if (typeof value === 'object' && value !== null && value.outcome === outcomeName) {
    return handler();
  }
  return value;
}

// Helper for partial pipes (|?>)
export function __partialPipe(value: any, fn: (v: any) => any): any {
  if (value === null || value === undefined) {
    return value;
  }
  return fn(value);
}
