#!/usr/bin/env node

/**
 * Build script for Stroum standard library
 * Compiles stdlib/core.stm and bundles with stdlib-runtime.ts
 */

const fs = require('fs');
const path = require('path');
const { Lexer } = require('../dist/tmp/lexer');
const { Parser } = require('../dist/tmp/parser');

const STDLIB_DIR = __dirname;
const CORE_STM = path.join(STDLIB_DIR, 'core.stm');
const RUNTIME_TS = path.join(STDLIB_DIR, 'stdlib-runtime.ts');
const OUTPUT_DIR = path.join(__dirname, '../dist/stdlib');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'stdlib-runtime.ts');

console.log('📦 Building Stroum Standard Library...\n');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read core.stm
if (!fs.existsSync(CORE_STM)) {
  console.error('❌ Error: stdlib/core.stm not found');
  process.exit(1);
}

const coreSource = fs.readFileSync(CORE_STM, 'utf-8');

// Parse core.stm to extract function signatures
console.log('📝 Parsing stdlib/core.stm...');
let functions = [];
try {
  const lexer = new Lexer(coreSource);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const module = parser.parse();
  
  // Extract all function declarations
  for (const def of module.definitions) {
    if (def.type === 'FunctionDeclaration') {
      functions.push({
        name: def.name,
        params: def.params,
        arity: def.params.length
      });
    }
  }
  
  console.log(`✅ Found ${functions.length} functions in core.stm\n`);
} catch (error) {
  console.error('❌ Failed to parse core.stm:', error.message);
  process.exit(1);
}

// Read runtime implementations
if (!fs.existsSync(RUNTIME_TS)) {
  console.error('❌ Error: stdlib/stdlib-runtime.ts not found');
  process.exit(1);
}

const runtimeSource = fs.readFileSync(RUNTIME_TS, 'utf-8');

// Copy runtime to output directory
console.log('📦 Copying stdlib-runtime.ts to dist/stdlib/...');
fs.writeFileSync(OUTPUT_FILE, runtimeSource);
console.log('✅ stdlib-runtime.ts copied\n');

// Generate exports list
console.log('📝 Generating exports...');
const exportNames = functions.map(fn => fn.name).join(', ');

console.log('✅ Standard Library Build Complete!\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Exported Functions: ${functions.length}`);
console.log(`Output: ${OUTPUT_FILE}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Print summary
console.log('Available functions:');
const perLine = 5;
for (let i = 0; i < functions.length; i += perLine) {
  const slice = functions.slice(i, i + perLine);
  const line = slice.map(f => `  ${f.name}/${f.arity}`).join('  ');
  console.log(line);
}

console.log('\n✅ Done!\n');
