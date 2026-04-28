// Runtime functions for simple-exec example

// Basic math operations
global.multiply = async (a, b) => a * b;
global.plus = async (a, b) => a + b;
global.print = async (value) => {
  console.log('Result:', value);
  return value;
};

// Import and run the transpiled code
import('./simple-exec.js')
  .then(() => console.log('✓ Execution complete'))
  .catch(err => console.error('Error:', err));
