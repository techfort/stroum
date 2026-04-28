"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const stdlib_runtime_1 = require("./stdlib-runtime");
const math_utils_1 = require("./math-utils");
async function main() {
    return await (0, stdlib_runtime_1.println)(await (0, stdlib_runtime_1.add)(await (0, math_utils_1.square)(5), await (0, math_utils_1.cube)(2)));
}
// Main program
(async () => {
    await await main();
})();
