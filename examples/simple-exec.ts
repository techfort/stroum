import { __router, __route, __matchOutcome, __partialPipe } from './stroum-runtime';

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