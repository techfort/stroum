import { __router, __route, __matchOutcome, __partialPipe } from './stroum-runtime';
import { add, sub, mul, div, mod, pow, abs, min, max, eq, neq, gt, gte, lt, lte, and, or, not, concat, length, upper, lower, trim, split, join, starts_with, ends_with, contains, map, filter, reduce, head, tail, take, drop, reverse, sort, is_empty, print, println, debug, trace, to_string, to_int, to_float, error, try_catch } from './stdlib-runtime';

export async function exec(cmd) {
  return await __builtin_exec(cmd);
}

export async function exec_lines(cmd) {
  return await __builtin_exec_lines(cmd);
}

export async function env_get(name) {
  return await __builtin_env_get(name);
}

export async function env_get_or(name, fallback) {
  return await __builtin_env_get_or(name, fallback);
}

export async function env_keys() {
  return await __builtin_env_keys();
}

export async function cwd() {
  return await __builtin_cwd();
}

export async function exit_process(code) {
  return await __builtin_exit_process(code);
}
