// Complete executable example - combining runtime and user code

// Stream Router (from stroum-runtime.ts)
class StreamRouter {
  constructor() {
    this.handlers = new Map();
    this.traceHandler = null;
  }

  emit(streamName, value) {
    const handlers = this.handlers.get(streamName);
    if (handlers) {
      for (const handler of handlers) {
        handler(value);
      }
    }
    if (this.traceHandler && streamName !== '__trace') {
      this.traceHandler({ stream: streamName, value });
    }
  }

  on(streamName, handler) {
    if (streamName === '__trace') {
      this.traceHandler = handler;
    } else {
      if (!this.handlers.has(streamName)) {
        this.handlers.set(streamName, []);
      }
      this.handlers.get(streamName).push(handler);
    }
  }
}

const __router = new StreamRouter();

function __route(value, streamName) {
  if (streamName) {
    __router.emit(streamName, value);
    return undefined;
  }
  return value;
}

// Built-in functions (provided by environment)
async function multiply(a, b) {
  return a * b;
}

async function plus(a, b) {
  return a + b;
}

async function print(value) {
  console.log('📤 Output:', value);
  return value;
}

// ============================================================================
// Transpiled Stroum code (from simple-exec.stm)
// ============================================================================

async function double(x) {
  return await multiply(x, 2);
}

async function add(a, b) {
  return await plus(a, b);
}

async function compute() {
  return await add(await double(5), await double(3));
}

// Main program
(async () => {
  console.log('🚀 Running transpiled Stroum program...\n');
  console.log('   Stroum source: compute() |> print');
  console.log('   where: compute => add(double(5), double(3))');
  console.log('          double x => multiply(x, 2)');
  console.log('          add a b => plus(a, b)\n');
  
  await print(await compute());
  
  console.log('\n✅ Execution complete!');
})();
