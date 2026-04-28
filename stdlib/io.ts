import { __router, __route, __matchOutcome, __partialPipe } from './stroum-runtime';
import { add, sub, mul, div, mod, pow, abs, min, max, eq, neq, gt, gte, lt, lte, and, or, not, concat, length, upper, lower, trim, split, join, starts_with, ends_with, contains, map, filter, reduce, head, tail, take, drop, reverse, sort, is_empty, print, println, debug, trace, to_string, to_int, to_float, error, try_catch } from './stdlib-runtime';

export async function read_file(path) {
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
