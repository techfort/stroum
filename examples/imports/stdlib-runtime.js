"use strict";
/**
 * Stroum Standard Library - Runtime Implementation
 * Version 1.0.0
 *
 * TypeScript/JavaScript implementations of standard library functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.to_float = exports.to_int = exports.to_string = exports.trace = exports.debug = exports.println = exports.is_empty = exports.sort = exports.reverse = exports.drop = exports.take = exports.tail = exports.head = exports.reduce = exports.filter = exports.map = exports.contains = exports.ends_with = exports.starts_with = exports.join = exports.split = exports.trim = exports.lower = exports.upper = exports.length = exports.concat = exports.not = exports.or = exports.and = exports.neq = exports.max = exports.min = exports.abs = exports.pow = exports.mod = exports.div = exports.mul = exports.sub = exports.add = exports.log = exports.print = exports.eq = exports.lte = exports.lt = exports.gte = exports.gt = exports.divide = exports.minus = exports.plus = exports.multiply = void 0;
exports.try_catch = exports.error = void 0;
exports.__builtin_add = __builtin_add;
exports.__builtin_sub = __builtin_sub;
exports.__builtin_mul = __builtin_mul;
exports.__builtin_div = __builtin_div;
exports.__builtin_mod = __builtin_mod;
exports.__builtin_pow = __builtin_pow;
exports.__builtin_abs = __builtin_abs;
exports.__builtin_min = __builtin_min;
exports.__builtin_max = __builtin_max;
exports.__builtin_eq = __builtin_eq;
exports.__builtin_neq = __builtin_neq;
exports.__builtin_gt = __builtin_gt;
exports.__builtin_gte = __builtin_gte;
exports.__builtin_lt = __builtin_lt;
exports.__builtin_lte = __builtin_lte;
exports.__builtin_and = __builtin_and;
exports.__builtin_or = __builtin_or;
exports.__builtin_not = __builtin_not;
exports.__builtin_concat = __builtin_concat;
exports.__builtin_length = __builtin_length;
exports.__builtin_upper = __builtin_upper;
exports.__builtin_lower = __builtin_lower;
exports.__builtin_trim = __builtin_trim;
exports.__builtin_split = __builtin_split;
exports.__builtin_join = __builtin_join;
exports.__builtin_starts_with = __builtin_starts_with;
exports.__builtin_ends_with = __builtin_ends_with;
exports.__builtin_contains = __builtin_contains;
exports.__builtin_map = __builtin_map;
exports.__builtin_filter = __builtin_filter;
exports.__builtin_reduce = __builtin_reduce;
exports.__builtin_head = __builtin_head;
exports.__builtin_tail = __builtin_tail;
exports.__builtin_take = __builtin_take;
exports.__builtin_drop = __builtin_drop;
exports.__builtin_reverse = __builtin_reverse;
exports.__builtin_sort = __builtin_sort;
exports.__builtin_is_empty = __builtin_is_empty;
exports.__builtin_print = __builtin_print;
exports.__builtin_println = __builtin_println;
exports.__builtin_debug = __builtin_debug;
exports.__builtin_trace = __builtin_trace;
exports.__builtin_to_string = __builtin_to_string;
exports.__builtin_to_int = __builtin_to_int;
exports.__builtin_to_float = __builtin_to_float;
exports.__builtin_error = __builtin_error;
exports.__builtin_try_catch = __builtin_try_catch;
// ============================================================================
// Arithmetic Operations
// ============================================================================
async function __builtin_add(a, b) {
    return a + b;
}
async function __builtin_sub(a, b) {
    return a - b;
}
async function __builtin_mul(a, b) {
    return a * b;
}
async function __builtin_div(a, b) {
    if (b === 0)
        throw new Error('Division by zero');
    return a / b;
}
async function __builtin_mod(a, b) {
    return a % b;
}
async function __builtin_pow(a, b) {
    return Math.pow(a, b);
}
async function __builtin_abs(n) {
    return Math.abs(n);
}
async function __builtin_min(a, b) {
    return Math.min(a, b);
}
async function __builtin_max(a, b) {
    return Math.max(a, b);
}
// ============================================================================
// Comparison Operations
// ============================================================================
async function __builtin_eq(a, b) {
    return a === b;
}
async function __builtin_neq(a, b) {
    return a !== b;
}
async function __builtin_gt(a, b) {
    return a > b;
}
async function __builtin_gte(a, b) {
    return a >= b;
}
async function __builtin_lt(a, b) {
    return a < b;
}
async function __builtin_lte(a, b) {
    return a <= b;
}
// ============================================================================
// Logic Operations
// ============================================================================
async function __builtin_and(a, b) {
    return a && b;
}
async function __builtin_or(a, b) {
    return a || b;
}
async function __builtin_not(a) {
    return !a;
}
// ============================================================================
// String Operations
// ============================================================================
async function __builtin_concat(a, b) {
    return a + b;
}
async function __builtin_length(s) {
    return s.length;
}
async function __builtin_upper(s) {
    return s.toUpperCase();
}
async function __builtin_lower(s) {
    return s.toLowerCase();
}
async function __builtin_trim(s) {
    return s.trim();
}
async function __builtin_split(s, delim) {
    return s.split(delim);
}
async function __builtin_join(arr, delim) {
    return arr.join(delim);
}
async function __builtin_starts_with(s, prefix) {
    return s.startsWith(prefix);
}
async function __builtin_ends_with(s, suffix) {
    return s.endsWith(suffix);
}
async function __builtin_contains(s, substr) {
    return s.includes(substr);
}
// ============================================================================
// List Operations
// ============================================================================
async function __builtin_map(fn, list) {
    return Promise.all(list.map(fn));
}
async function __builtin_filter(fn, list) {
    const results = await Promise.all(list.map(async (item) => ({
        item,
        keep: await fn(item)
    })));
    return results.filter(r => r.keep).map(r => r.item);
}
async function __builtin_reduce(fn, init, list) {
    let acc = init;
    for (const item of list) {
        acc = await fn(acc, item);
    }
    return acc;
}
async function __builtin_head(list) {
    if (list.length === 0)
        throw new Error('head: empty list');
    return list[0];
}
async function __builtin_tail(list) {
    if (list.length === 0)
        throw new Error('tail: empty list');
    return list.slice(1);
}
async function __builtin_take(n, list) {
    return list.slice(0, n);
}
async function __builtin_drop(n, list) {
    return list.slice(n);
}
async function __builtin_reverse(list) {
    return [...list].reverse();
}
async function __builtin_sort(list) {
    return [...list].sort();
}
async function __builtin_is_empty(list) {
    return list.length === 0;
}
// ============================================================================
// I/O Operations
// ============================================================================
async function __builtin_print(value) {
    console.log(value);
    return value;
}
async function __builtin_println(value) {
    console.log(value);
    return value;
}
async function __builtin_debug(value, label) {
    console.log(`[DEBUG ${label}]:`, value);
    return value;
}
async function __builtin_trace(message) {
    console.log(`[TRACE] ${message}`);
}
// ============================================================================
// Type Conversion
// ============================================================================
async function __builtin_to_string(value) {
    return String(value);
}
async function __builtin_to_int(value) {
    const result = parseInt(value, 10);
    if (isNaN(result))
        throw new Error(`Cannot convert ${value} to integer`);
    return result;
}
async function __builtin_to_float(value) {
    const result = parseFloat(value);
    if (isNaN(result))
        throw new Error(`Cannot convert ${value} to float`);
    return result;
}
// ============================================================================
// Error Handling
// ============================================================================
async function __builtin_error(message) {
    throw new Error(message);
}
async function __builtin_try_catch(fn, fallback) {
    try {
        return await fn();
    }
    catch (error) {
        return await fallback(error);
    }
}
// ============================================================================
// Legacy Aliases (for backward compatibility)
// ============================================================================
exports.multiply = __builtin_mul;
exports.plus = __builtin_add;
exports.minus = __builtin_sub;
exports.divide = __builtin_div;
exports.gt = __builtin_gt;
exports.gte = __builtin_gte;
exports.lt = __builtin_lt;
exports.lte = __builtin_lte;
exports.eq = __builtin_eq;
exports.print = __builtin_print;
exports.log = __builtin_trace;
// ============================================================================
// Simple Name Exports (for module imports)
// ============================================================================
exports.add = __builtin_add;
exports.sub = __builtin_sub;
exports.mul = __builtin_mul;
exports.div = __builtin_div;
exports.mod = __builtin_mod;
exports.pow = __builtin_pow;
exports.abs = __builtin_abs;
exports.min = __builtin_min;
exports.max = __builtin_max;
exports.neq = __builtin_neq;
exports.and = __builtin_and;
exports.or = __builtin_or;
exports.not = __builtin_not;
exports.concat = __builtin_concat;
exports.length = __builtin_length;
exports.upper = __builtin_upper;
exports.lower = __builtin_lower;
exports.trim = __builtin_trim;
exports.split = __builtin_split;
exports.join = __builtin_join;
exports.starts_with = __builtin_starts_with;
exports.ends_with = __builtin_ends_with;
exports.contains = __builtin_contains;
exports.map = __builtin_map;
exports.filter = __builtin_filter;
exports.reduce = __builtin_reduce;
exports.head = __builtin_head;
exports.tail = __builtin_tail;
exports.take = __builtin_take;
exports.drop = __builtin_drop;
exports.reverse = __builtin_reverse;
exports.sort = __builtin_sort;
exports.is_empty = __builtin_is_empty;
exports.println = __builtin_println;
exports.debug = __builtin_debug;
exports.trace = __builtin_trace;
exports.to_string = __builtin_to_string;
exports.to_int = __builtin_to_int;
exports.to_float = __builtin_to_float;
exports.error = __builtin_error;
exports.try_catch = __builtin_try_catch;
