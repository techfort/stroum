import {
  abs,
  add,
  and,
  concat,
  contains,
  debug,
  div,
  drop,
  ends_with,
  eq,
  error,
  filter,
  gt,
  gte,
  head,
  infer_schema,
  is_empty,
  join,
  length,
  lower,
  lt,
  lte,
  map,
  max,
  min,
  mod,
  mul,
  neq,
  not,
  or,
  pow,
  print,
  println,
  read_csv,
  read_json,
  reduce,
  reverse,
  sort,
  split,
  starts_with,
  sub,
  tail,
  take,
  to_float,
  to_int,
  to_string,
  trace,
  trim,
  try_catch,
  upper,
} from "./stdlib-runtime";
import {
  __matchOutcome,
  __partialPipe,
  __route,
  __router,
  __runForever,
  __runtimeControl,
  __runUntilSignal,
  __runUntilStream,
  __runUntilTimeout,
} from "./stroum-runtime";

export async function read_file(path) {
  return await __builtin_read_file(path);
}

export async function file(path) {
  return await __builtin_read_file(path);
}

export async function write_file(path, content) {
  return await __builtin_write_file(path, content);
}

export async function append_file(path, content) {
  return await __builtin_append_file(path, content);
}

export async function file_exists(path) {
  return await __builtin_file_exists(path);
}

export async function delete_file(path) {
  return await __builtin_delete_file(path);
}

export async function list_dir(path) {
  return await __builtin_list_dir(path);
}

export async function make_dir(path) {
  return await __builtin_make_dir(path);
}

export async function read_lines(path) {
  return await __builtin_read_lines(path);
}

export async function write_lines(path, lines) {
  return await __builtin_write_lines(path, lines);
}

export async function path_join(base, part) {
  return await __builtin_path_join(base, part);
}

export async function path_basename(path) {
  return await __builtin_path_basename(path);
}

export async function path_dirname(path) {
  return await __builtin_path_dirname(path);
}

export async function path_ext(path) {
  return await __builtin_path_ext(path);
}

export async function watch_file(path, callback) {
  return await __builtin_watch_file(path, callback);
}
