import { __router, __route, __matchOutcome, __partialPipe } from './stroum-runtime';

async function double(n) {
  return await multiply(n, 2);
}

async function add(a, b) {
  return await plus(a, b);
}

const result = await double(5);