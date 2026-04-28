import { __router, __route, __matchOutcome, __partialPipe } from './stroum-runtime';

async function validate(num) {
  return (async () => {
        let __value = await check(num);
        if (__value && typeof __value === 'object' && __value.outcome === 'ok') {
          __value = __route(log_ok, "valid");
        }
        if (__value && typeof __value === 'object' && __value.outcome === 'error') {
          __value = __route(log_err, "errors");
        }
        return __value;
      })();
}


// Main program
(async () => {
  __router.on("valid", async (x) => await report(x));
  __router.on("errors", async (e) => await alert(e));
  await (async () => {
        let __value = __route(await validate(42), "done");
        if (__value && typeof __value === 'object' && __value.outcome === 'timeout') {
          __value = __route(await retry(), "errors");
        }
        return __value;
      })();
})();