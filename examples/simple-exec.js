"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function double(x) {
    return await multiply(x, 2);
}
async function add(a, b) {
    return await plus(a, b);
}
async function compute() {
    return await add(await double(5), await double(3));
}
// Main program
(async () => {
    await await print(await compute());
})();
