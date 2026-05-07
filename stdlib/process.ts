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
