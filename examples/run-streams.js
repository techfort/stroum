// Complete executable example with streams

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
async function check(num) {
  console.log(`  🔍 Checking value: ${num}`);
  if (num > 0) {
    return { outcome: 'ok', value: num };
  } else {
    return { outcome: 'error', message: 'Invalid number' };
  }
}

async function log_ok(value) {
  console.log(`  ✅ Valid value processed: ${value}`);
  return value;
}

async function log_err(error) {
  console.log(`  ❌ Error encountered: ${error.message || error}`);
  return error;
}

async function report(x) {
  console.log(`  📊 Reporting to analytics: ${JSON.stringify(x)}`);
}

async function alert(e) {
  console.log(`  🚨 Alert sent: ${JSON.stringify(e)}`);
}

async function retry() {
  console.log(`  🔄 Retrying operation...`);
  return { status: 'retry' };
}

// ============================================================================
// Transpiled Stroum code (from streams-example.stm)
// ============================================================================

async function validate(num) {
  return (async () => {
        let __value = await check(num);
        if (__value && typeof __value === 'object' && __value.outcome === 'ok') {
          __value = __route(await log_ok(__value), "valid");
        }
        if (__value && typeof __value === 'object' && __value.outcome === 'error') {
          __value = __route(await log_err(__value), "errors");
        }
        return __value;
      })();
}

// Main program
(async () => {
  console.log('🚀 Running Stroum program with streams...\n');
  console.log('   Source: validate(42) @ "done"');
  console.log('   With handlers for @"valid" and @"errors" streams\n');
  
  __router.on("valid", async (x) => await report(x));
  __router.on("errors", async (e) => await alert(e));
  
  await (async () => {
        let __value = __route(await validate(42), "done");
        if (__value && typeof __value === 'object' && __value.outcome === 'timeout') {
          __value = __route(await retry(), "errors");
        }
        return __value;
      })();
  
  console.log('\n✅ Execution complete!');
})();
