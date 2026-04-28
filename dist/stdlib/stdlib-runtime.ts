/**
 * Stroum Standard Library - Runtime Implementation
 * Version 1.0.0
 * 
 * TypeScript/JavaScript implementations of standard library functions
 */

import * as _fs from 'fs';
import * as _path from 'path';
import { exec as _execCb } from 'child_process';
import { promisify as _promisify } from 'util';

const _execAsync = _promisify(_execCb);

// ============================================================================
// Arithmetic Operations
// ============================================================================

export async function __builtin_add(a: number, b: number): Promise<number> {
  return a + b;
}

export async function __builtin_sub(a: number, b: number): Promise<number> {
  return a - b;
}

export async function __builtin_mul(a: number, b: number): Promise<number> {
  return a * b;
}

export async function __builtin_div(a: number, b: number): Promise<number> {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

export async function __builtin_mod(a: number, b: number): Promise<number> {
  return a % b;
}

export async function __builtin_pow(a: number, b: number): Promise<number> {
  return Math.pow(a, b);
}

export async function __builtin_abs(n: number): Promise<number> {
  return Math.abs(n);
}

export async function __builtin_min(a: number, b: number): Promise<number> {
  return Math.min(a, b);
}

export async function __builtin_max(a: number, b: number): Promise<number> {
  return Math.max(a, b);
}

// ============================================================================
// Comparison Operations
// ============================================================================

export async function __builtin_eq(a: any, b: any): Promise<boolean> {
  return a === b;
}

export async function __builtin_neq(a: any, b: any): Promise<boolean> {
  return a !== b;
}

export async function __builtin_gt(a: number, b: number): Promise<boolean> {
  return a > b;
}

export async function __builtin_gte(a: number, b: number): Promise<boolean> {
  return a >= b;
}

export async function __builtin_lt(a: number, b: number): Promise<boolean> {
  return a < b;
}

export async function __builtin_lte(a: number, b: number): Promise<boolean> {
  return a <= b;
}

// ============================================================================
// Logic Operations
// ============================================================================

export async function __builtin_and(a: boolean, b: boolean): Promise<boolean> {
  return a && b;
}

export async function __builtin_or(a: boolean, b: boolean): Promise<boolean> {
  return a || b;
}

export async function __builtin_not(a: boolean): Promise<boolean> {
  return !a;
}

// ============================================================================
// String Operations
// ============================================================================

export async function __builtin_concat(a: string, b: string): Promise<string> {
  return a + b;
}

export async function __builtin_length(s: string): Promise<number> {
  return s.length;
}

export async function __builtin_upper(s: string): Promise<string> {
  return s.toUpperCase();
}

export async function __builtin_lower(s: string): Promise<string> {
  return s.toLowerCase();
}

export async function __builtin_trim(s: string): Promise<string> {
  return s.trim();
}

export async function __builtin_split(s: string, delim: string): Promise<string[]> {
  return s.split(delim);
}

export async function __builtin_join(arr: any[], delim: string): Promise<string> {
  return arr.join(delim);
}

export async function __builtin_starts_with(s: string, prefix: string): Promise<boolean> {
  return s.startsWith(prefix);
}

export async function __builtin_ends_with(s: string, suffix: string): Promise<boolean> {
  return s.endsWith(suffix);
}

export async function __builtin_contains(s: string, substr: string): Promise<boolean> {
  return s.includes(substr);
}

// ============================================================================
// List Operations
// ============================================================================

export async function __builtin_map<T, U>(fn: (x: T) => Promise<U>, list: T[]): Promise<U[]> {
  return Promise.all(list.map(fn));
}

export async function __builtin_filter<T>(fn: (x: T) => Promise<boolean>, list: T[]): Promise<T[]> {
  const results = await Promise.all(list.map(async (item) => ({
    item,
    keep: await fn(item)
  })));
  return results.filter(r => r.keep).map(r => r.item);
}

export async function __builtin_reduce<T, U>(
  fn: (acc: U, item: T) => Promise<U>,
  init: U,
  list: T[]
): Promise<U> {
  let acc = init;
  for (const item of list) {
    acc = await fn(acc, item);
  }
  return acc;
}

export async function __builtin_head<T>(list: T[]): Promise<T> {
  if (list.length === 0) throw new Error('head: empty list');
  return list[0];
}

export async function __builtin_tail<T>(list: T[]): Promise<T[]> {
  if (list.length === 0) throw new Error('tail: empty list');
  return list.slice(1);
}

export async function __builtin_take<T>(n: number, list: T[]): Promise<T[]> {
  return list.slice(0, n);
}

export async function __builtin_drop<T>(n: number, list: T[]): Promise<T[]> {
  return list.slice(n);
}

export async function __builtin_reverse<T>(list: T[]): Promise<T[]> {
  return [...list].reverse();
}

export async function __builtin_sort<T>(list: T[]): Promise<T[]> {
  return [...list].sort();
}

export async function __builtin_is_empty<T>(list: T[]): Promise<boolean> {
  return list.length === 0;
}

// ============================================================================
// I/O Operations
// ============================================================================

export async function __builtin_print(value: any): Promise<any> {
  console.log(value);
  return value;
}

export async function __builtin_println(value: any): Promise<any> {
  console.log(value);
  return value;
}

export async function __builtin_debug(value: any, label: string): Promise<any> {
  console.log(`[DEBUG ${label}]:`, value);
  return value;
}

export async function __builtin_trace(message: string): Promise<void> {
  console.log(`[TRACE] ${message}`);
}

// ============================================================================
// Type Conversion
// ============================================================================

export async function __builtin_to_string(value: any): Promise<string> {
  return String(value);
}

export async function __builtin_to_int(value: any): Promise<number> {
  const result = parseInt(value, 10);
  if (isNaN(result)) throw new Error(`Cannot convert ${value} to integer`);
  return result;
}

export async function __builtin_to_float(value: any): Promise<number> {
  const result = parseFloat(value);
  if (isNaN(result)) throw new Error(`Cannot convert ${value} to float`);
  return result;
}

// ============================================================================
// Error Handling
// ============================================================================

export async function __builtin_error(message: string): Promise<never> {
  throw new Error(message);
}

export async function __builtin_try_catch<T>(
  fn: () => Promise<T>,
  fallback: (error: Error) => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    return await fallback(error as Error);
  }
}

// ============================================================================
// Legacy Aliases (for backward compatibility)
// ============================================================================

export const multiply = __builtin_mul;
export const plus = __builtin_add;
export const minus = __builtin_sub;
export const divide = __builtin_div;
export const gt = __builtin_gt;
export const gte = __builtin_gte;
export const lt = __builtin_lt;
export const lte = __builtin_lte;
export const eq = __builtin_eq;
export const print = __builtin_print;
export const log = __builtin_trace;

// ============================================================================
// Simple Name Exports (for module imports)
// ============================================================================

export const add = __builtin_add;
export const sub = __builtin_sub;
export const mul = __builtin_mul;
export const div = __builtin_div;
export const mod = __builtin_mod;
export const pow = __builtin_pow;
export const abs = __builtin_abs;
export const min = __builtin_min;
export const max = __builtin_max;
export const neq = __builtin_neq;
export const and = __builtin_and;
export const or = __builtin_or;
export const not = __builtin_not;
export const concat = __builtin_concat;
export const length = __builtin_length;
export const upper = __builtin_upper;
export const lower = __builtin_lower;
export const trim = __builtin_trim;
export const split = __builtin_split;
export const join = __builtin_join;
export const starts_with = __builtin_starts_with;
export const ends_with = __builtin_ends_with;
export const contains = __builtin_contains;
export const map = __builtin_map;
export const filter = __builtin_filter;
export const reduce = __builtin_reduce;
export const head = __builtin_head;
export const tail = __builtin_tail;
export const take = __builtin_take;
export const drop = __builtin_drop;
export const reverse = __builtin_reverse;
export const sort = __builtin_sort;
export const is_empty = __builtin_is_empty;
export const println = __builtin_println;
export const debug = __builtin_debug;
export const trace = __builtin_trace;
export const to_string = __builtin_to_string;
export const to_int = __builtin_to_int;
export const to_float = __builtin_to_float;
export const error = __builtin_error;
export const try_catch = __builtin_try_catch;

// ============================================================================
// IO Operations (available via i:io)
// ============================================================================

export async function __builtin_read_file(filePath: string): Promise<string> {
  return _fs.promises.readFile(filePath, 'utf-8');
}

export async function __builtin_write_file(filePath: string, content: string): Promise<string> {
  await _fs.promises.writeFile(filePath, content, 'utf-8');
  return filePath;
}

export async function __builtin_append_file(filePath: string, content: string): Promise<string> {
  await _fs.promises.appendFile(filePath, content, 'utf-8');
  return filePath;
}

export async function __builtin_file_exists(filePath: string): Promise<boolean> {
  try {
    await _fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function __builtin_delete_file(filePath: string): Promise<string> {
  await _fs.promises.unlink(filePath);
  return filePath;
}

export async function __builtin_list_dir(dirPath: string): Promise<string[]> {
  return _fs.promises.readdir(dirPath);
}

export async function __builtin_make_dir(dirPath: string): Promise<string> {
  await _fs.promises.mkdir(dirPath, { recursive: true });
  return dirPath;
}

export async function __builtin_read_lines(filePath: string): Promise<string[]> {
  const content = await _fs.promises.readFile(filePath, 'utf-8');
  return content.split('\n');
}

export async function __builtin_write_lines(filePath: string, lines: string[]): Promise<string> {
  await _fs.promises.writeFile(filePath, lines.join('\n'), 'utf-8');
  return filePath;
}

export async function __builtin_path_join(base: string, part: string): Promise<string> {
  return _path.join(base, part);
}

export async function __builtin_path_basename(filePath: string): Promise<string> {
  return _path.basename(filePath);
}

export async function __builtin_path_dirname(filePath: string): Promise<string> {
  return _path.dirname(filePath);
}

export async function __builtin_path_ext(filePath: string): Promise<string> {
  return _path.extname(filePath);
}

export const read_file = __builtin_read_file;
export const write_file = __builtin_write_file;
export const append_file = __builtin_append_file;
export const file_exists = __builtin_file_exists;
export const delete_file = __builtin_delete_file;
export const list_dir = __builtin_list_dir;
export const make_dir = __builtin_make_dir;
export const read_lines = __builtin_read_lines;
export const write_lines = __builtin_write_lines;
export const path_join = __builtin_path_join;
export const path_basename = __builtin_path_basename;
export const path_dirname = __builtin_path_dirname;
export const path_ext = __builtin_path_ext;

// ============================================================================
// Process Operations (available via i:process)
// ============================================================================

export async function __builtin_exec(command: string): Promise<string> {
  const { stdout } = await _execAsync(command);
  return stdout.trimEnd();
}

export async function __builtin_exec_lines(command: string): Promise<string[]> {
  const { stdout } = await _execAsync(command);
  return stdout.trimEnd().split('\n').filter((l: string) => l.length > 0);
}

export async function __builtin_env_get(name: string): Promise<string> {
  const value = process.env[name];
  if (value === undefined) throw new Error(`Environment variable '${name}' is not set`);
  return value;
}

export async function __builtin_env_get_or(name: string, fallback: string): Promise<string> {
  return process.env[name] ?? fallback;
}

export async function __builtin_env_keys(): Promise<string[]> {
  return Object.keys(process.env);
}

export async function __builtin_cwd(): Promise<string> {
  return process.cwd();
}

export async function __builtin_exit_process(code: number): Promise<never> {
  process.exit(code);
}

export const exec = __builtin_exec;
export const exec_lines = __builtin_exec_lines;
export const env_get = __builtin_env_get;
export const env_get_or = __builtin_env_get_or;
export const env_keys = __builtin_env_keys;
export const cwd = __builtin_cwd;
export const exit_process = __builtin_exit_process;

// ============================================================================
// Timer Operations (available via i:timer)
// ============================================================================

export async function __builtin_sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function __builtin_now(): Promise<number> {
  return Date.now();
}

export async function __builtin_timestamp(): Promise<string> {
  return new Date().toISOString();
}

export async function __builtin_elapsed(startMs: number): Promise<number> {
  return Date.now() - startMs;
}

export async function __builtin_format_date(ms: number, locale: string): Promise<string> {
  return new Date(ms).toLocaleString(locale);
}

export const sleep = __builtin_sleep;
export const now = __builtin_now;
export const timestamp = __builtin_timestamp;
export const elapsed = __builtin_elapsed;
export const format_date = __builtin_format_date;
