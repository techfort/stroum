import { __router, __route, __matchOutcome, __partialPipe, __runtimeControl, __runUntilSignal, __runUntilStream, __runUntilTimeout, __runForever } from './stroum-runtime';
import { add, sub, mul, div, mod, pow, abs, min, max, eq, neq, gt, gte, lt, lte, and, or, not, concat, length, upper, lower, trim, split, join, starts_with, ends_with, contains, map, filter, reduce, head, tail, take, drop, reverse, sort, is_empty, print, println, null_sink, log_sink, debug, trace, to_string, to_int, to_float, error, try_catch, infer_schema, read_csv, read_json, assert, assert_eq, assert_neq, assert_contains, assert_raises } from './stdlib-runtime';

export async function add(a: number, b: number): Promise<number> {
  return await __builtin_add(a, b);
}

export async function sub(a: number, b: number): Promise<number> {
  return await __builtin_sub(a, b);
}

export async function mul(a: number, b: number): Promise<number> {
  return await __builtin_mul(a, b);
}

export async function div(a: number, b: number): Promise<number> {
  return await __builtin_div(a, b);
}

export async function mod(a: number, b: number): Promise<number> {
  return await __builtin_mod(a, b);
}

export async function pow(a: number, b: number): Promise<number> {
  return await __builtin_pow(a, b);
}

export async function abs(n: number): Promise<number> {
  return await __builtin_abs(n);
}

export async function min(a: number, b: number): Promise<number> {
  return await __builtin_min(a, b);
}

export async function max(a: number, b: number): Promise<number> {
  return await __builtin_max(a, b);
}

export async function eq(a: any, b: any): Promise<boolean> {
  return await __builtin_eq(a, b);
}

export async function neq(a: any, b: any): Promise<boolean> {
  return await __builtin_neq(a, b);
}

export async function gt(a: any, b: any): Promise<boolean> {
  return await __builtin_gt(a, b);
}

export async function gte(a: any, b: any): Promise<boolean> {
  return await __builtin_gte(a, b);
}

export async function lt(a: any, b: any): Promise<boolean> {
  return await __builtin_lt(a, b);
}

export async function lte(a: any, b: any): Promise<boolean> {
  return await __builtin_lte(a, b);
}

export async function and(a: boolean, b: boolean): Promise<boolean> {
  return await __builtin_and(a, b);
}

export async function or(a: boolean, b: boolean): Promise<boolean> {
  return await __builtin_or(a, b);
}

export async function not(a: boolean): Promise<boolean> {
  return await __builtin_not(a);
}

export async function concat(a: string, b: string): Promise<string> {
  return await __builtin_concat(a, b);
}

export async function length(s: string): Promise<number> {
  return await __builtin_length(s);
}

export async function upper(s: string): Promise<string> {
  return await __builtin_upper(s);
}

export async function lower(s: string): Promise<string> {
  return await __builtin_lower(s);
}

export async function trim(s: string): Promise<string> {
  return await __builtin_trim(s);
}

export async function split(s: string, delim: string): Promise<any> {
  return await __builtin_split(s, delim);
}

export async function join(arr: any, delim: string): Promise<string> {
  return await __builtin_join(arr, delim);
}

export async function starts_with(s: string, prefix: string): Promise<boolean> {
  return await __builtin_starts_with(s, prefix);
}

export async function ends_with(s: string, suffix: string): Promise<boolean> {
  return await __builtin_ends_with(s, suffix);
}

export async function contains(s: string, substr: string): Promise<boolean> {
  return await __builtin_contains(s, substr);
}

export async function map(fn: Function, list: any): Promise<any> {
  return await __builtin_map(fn, list);
}

export async function filter(fn: Function, list: any): Promise<any> {
  return await __builtin_filter(fn, list);
}

export async function reduce(fn: Function, init: any, list: any): Promise<any> {
  return await __builtin_reduce(fn, init, list);
}

export async function head(list: any): Promise<any> {
  return await __builtin_head(list);
}

export async function tail(list: any): Promise<any> {
  return await __builtin_tail(list);
}

export async function take(n: number, list: any): Promise<any> {
  return await __builtin_take(n, list);
}

export async function drop(n: number, list: any): Promise<any> {
  return await __builtin_drop(n, list);
}

export async function reverse(list: any): Promise<any> {
  return await __builtin_reverse(list);
}

export async function sort(list: any): Promise<any> {
  return await __builtin_sort(list);
}

export async function is_empty(list: any): Promise<boolean> {
  return await __builtin_is_empty(list);
}

export async function print(value: any): Promise<void> {
  return await __builtin_print(value);
}

export async function println(value: any): Promise<void> {
  return await __builtin_println(value);
}

export async function stdout(value: any): Promise<void> {
  return await __builtin_println(value);
}

export async function null_sink(value: any): Promise<void> {
  return await __builtin_null_sink(value);
}

export async function log_sink(prefix: string): Promise<any> {
  return await __builtin_log_sink(prefix);
}

export async function debug(value: any, label: string): Promise<any> {
  return await __builtin_debug(value, label);
}

export async function trace(message: string): Promise<void> {
  return await __builtin_trace(message);
}

export async function to_string(value: any): Promise<string> {
  return await __builtin_to_string(value);
}

export async function to_int(value: any): Promise<number> {
  return await __builtin_to_int(value);
}

export async function to_float(value: any): Promise<number> {
  return await __builtin_to_float(value);
}

export async function error(message: string): Promise<any> {
  return await __builtin_error(message);
}

export async function try_catch(fn: Function, fallback: any): Promise<any> {
  return await __builtin_try_catch(fn, fallback);
}

export async function assert(condition: boolean): Promise<void> {
  return await assert(condition);
}

export async function assert_eq(left: any, right: any): Promise<void> {
  return await assert_eq(left, right);
}

export async function assert_neq(left: any, right: any): Promise<void> {
  return await assert_neq(left, right);
}

export async function assert_contains(collection: any, item: any): Promise<void> {
  return await assert_contains(collection, item);
}

export async function assert_raises(fn: Function): Promise<void> {
  return await assert_raises(fn);
}

//# sourceMappingURL=core.ts.map