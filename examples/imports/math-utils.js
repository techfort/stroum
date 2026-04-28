"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.square = square;
exports.cube = cube;
exports.double = double;
exports.triple = triple;
const stdlib_runtime_1 = require("./stdlib-runtime");
async function square(x) {
    return await (0, stdlib_runtime_1.mul)(x, x);
}
async function cube(x) {
    return await (0, stdlib_runtime_1.mul)(await (0, stdlib_runtime_1.mul)(x, x), x);
}
async function double(x) {
    return await (0, stdlib_runtime_1.mul)(x, 2);
}
async function triple(x) {
    return await (0, stdlib_runtime_1.mul)(x, 3);
}
