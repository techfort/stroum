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
