"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.double = double;
exports.add_ten = add_ten;
exports.process_data = process_data;
const stdlib_runtime_1 = require("./stdlib-runtime");
async function double(n) {
    return await (0, stdlib_runtime_1.mul)(n, 2);
}
async function add_ten(n) {
    return await (0, stdlib_runtime_1.add)(n, 10);
}
async function process_data(data) {
    return await (0, stdlib_runtime_1.println)(await add_ten(await double(data)));
}
// Main program
(async () => {
    await await process_data(21);
})();
