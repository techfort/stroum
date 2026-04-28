import { __router, __route, __matchOutcome, __partialPipe } from './stroum-runtime';
import { add, sub, mul, div, mod, pow, abs, min, max, eq, neq, gt, gte, lt, lte, and, or, not, concat, length, upper, lower, trim, split, join, starts_with, ends_with, contains, map, filter, reduce, head, tail, take, drop, reverse, sort, is_empty, print, println, debug, trace, to_string, to_int, to_float, error, try_catch } from './stdlib-runtime';

export async function main() {
  return await println(await mul(await add(5, 3), 2));
}


// Main program
(async () => {
  await await main();
})();