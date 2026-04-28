import { __router, __route, __matchOutcome, __partialPipe } from './stroum-runtime';

async function parse(raw) {
  return (async () => {
        let __value = __route(await json_parse(raw), "ok");
        if (__value && typeof __value === 'object' && __value.outcome === 'fail') {
          __value = __route(__value, "fail");
        }
        return __value;
      })();
}

async function transform(data) {
  return (async () => {
        let __value = __route(await validate(await normalise(data)), "clean");
        if (__value && typeof __value === 'object' && __value.outcome === 'invalid') {
          __value = __route(__value, "rejected");
        }
        return __value;
      })();
}


// Main program
(async () => {
  __router.on("errors", async (e) => await store(e));
  __router.on("__trace", async (e) => await console_log(e));
  await __route((async () => {
        let __value = __route(await transform(await parse(await merge(await Promise.all([await fetch(primary), await fetch(secondary)])))), "clean");
        if (__value && typeof __value === 'object' && __value.outcome === 'fail') {
          __value = __route(await log(), "errors");
        }
        if (__value && typeof __value === 'object' && __value.outcome === 'rejected') {
          __value = __route(await notify(), "rejected");
        }
        return __value;
      })(), "clean");
})();