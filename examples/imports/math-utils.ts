import { __router, __route, __matchOutcome, __partialPipe } from './stroum-runtime';
import { add, sub, mul, div, mod, pow, abs, min, max, eq, neq, gt, gte, lt, lte, and, or, not, concat, length, upper, lower, trim, split, join, starts_with, ends_with, contains, map, filter, reduce, head, tail, take, drop, reverse, sort, is_empty, print, println, debug, trace, to_string, to_int, to_float, error, try_catch } from './stdlib-runtime';

export async function square(x) {
  return await mul(x, x);
}

export async function cube(x) {
  return await mul(await mul(x, x), x);
}

export async function double(x) {
  return await mul(x, 2);
}

export async function triple(x) {
  return await mul(x, 3);
}
