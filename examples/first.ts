import { __router, __route, __matchOutcome, __partialPipe } from './stroum-runtime';
import { add, sub, mul, div, mod, pow, abs, min, max, eq, neq, gt, gte, lt, lte, and, or, not, concat, length, upper, lower, trim, split, join, starts_with, ends_with, contains, map, filter, reduce, head, tail, take, drop, reverse, sort, is_empty, print, println, debug, trace, to_string, to_int, to_float, error, try_catch } from './stdlib-runtime';

export async function test(x) {
  return x;
}

export async function negate(x) {
  return await mul(x, await sub(0, 1));
}

const ok = "ok";
const negative = "negative";

// Main program
(async () => {
  __router.on("ok", async (__routeValue) => { await await println(await to_string(await negate(__routeValue))); });
  __router.on(negative, async (__routeValue) => { await await println("Received negative: ", await to_string(__routeValue)); });
  await __route(await test(5), ok);
  await __route(await test(await sub(0, 3)), ok);
  await __route(await sub(0, 10), negative);
})();