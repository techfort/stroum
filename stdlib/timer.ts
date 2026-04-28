import { __router, __route, __matchOutcome, __partialPipe } from './stroum-runtime';
import { add, sub, mul, div, mod, pow, abs, min, max, eq, neq, gt, gte, lt, lte, and, or, not, concat, length, upper, lower, trim, split, join, starts_with, ends_with, contains, map, filter, reduce, head, tail, take, drop, reverse, sort, is_empty, print, println, debug, trace, to_string, to_int, to_float, error, try_catch } from './stdlib-runtime';

export async function sleep(ms) {
  return await __builtin_sleep(ms);
}

export async function now() {
  return await __builtin_now();
}

export async function timestamp() {
  return await __builtin_timestamp();
}

export async function elapsed(start) {
  return await __builtin_elapsed(start);
}

export async function format_date(ms, locale) {
  return await __builtin_format_date(ms, locale);
}
