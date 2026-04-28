"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const stdlib_runtime_1 = require("./stdlib-runtime");
async function main() {
    return await (0, stdlib_runtime_1.println)(await (0, stdlib_runtime_1.mul)(await (0, stdlib_runtime_1.add)(5, 3), 2));
}
// Main program
(async () => {
    await await main();
})();
