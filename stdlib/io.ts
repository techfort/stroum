import { __router, __route, __matchOutcome, __partialPipe, __runtimeControl, __runUntilSignal, __runUntilStream, __runUntilTimeout, __runForever } from './stroum-runtime';
import { add, sub, mul, div, mod, pow, abs, min, max, eq, neq, gt, gte, lt, lte, and, or, not, concat, length, upper, lower, trim, split, join, starts_with, ends_with, contains, map, filter, reduce, head, tail, take, drop, reverse, sort, is_empty, nth, each, zip, flatten, count, from_list, print, println, null_sink, log_sink, debug, trace, to_string, to_int, to_float, error, try_catch, infer_schema, read_csv, read_json, assert, assert_eq, assert_neq, assert_contains, assert_raises, stream_info } from './stdlib-runtime';

export async function read_file(path: string): Promise<string> {
  return await __builtin_read_file(path);
}

export async function file(path: string): Promise<string> {
  return await __builtin_read_file(path);
}

export async function write_file(path: string, content: string): Promise<void> {
  return await __builtin_write_file(path, content);
}

export async function append_file(path: string, content: string): Promise<void> {
  return await __builtin_append_file(path, content);
}

export async function jsonl_file(path: string, value: any): Promise<void> {
  return await __builtin_append_file(path, `${await to_string(value)}
`);
}

export async function file_exists(path: string): Promise<boolean> {
  return await __builtin_file_exists(path);
}

export async function delete_file(path: string): Promise<void> {
  return await __builtin_delete_file(path);
}

export async function list_dir(path: string): Promise<any> {
  return await __builtin_list_dir(path);
}

export async function make_dir(path: string): Promise<void> {
  return await __builtin_make_dir(path);
}

export async function read_lines(path: string): Promise<any> {
  return await __builtin_read_lines(path);
}

export async function write_lines(path: string, lines: any): Promise<void> {
  return await __builtin_write_lines(path, lines);
}

export async function path_join(base: string, part: string): Promise<string> {
  return await __builtin_path_join(base, part);
}

export async function path_basename(path: string): Promise<string> {
  return await __builtin_path_basename(path);
}

export async function path_dirname(path: string): Promise<string> {
  return await __builtin_path_dirname(path);
}

export async function path_ext(path: string): Promise<string> {
  return await __builtin_path_ext(path);
}

export async function watch_file(path: string, callback: Function): Promise<void> {
  return await __builtin_watch_file(path, callback);
}

export async function read_records(path: string): Promise<any> {
  return await read_records(path);
}

export async function stdin_lines(): Promise<void> {
  return await stdin_lines();
}

export async function file_sink(path: string): Promise<any> {
  return await __builtin_file_sink(path);
}

export async function jsonl_sink(path: string): Promise<any> {
  return await __builtin_jsonl_sink(path);
}

export async function http_sink(url: string): Promise<any> {
  return await __builtin_http_sink(url);
}

export async function http_poll(url: string, ms: number): Promise<void> {
  return await http_poll(url, ms);
}

//# sourceMappingURL=io.ts.map