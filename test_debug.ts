import { Lexer } from './src/lexer';
import { Parser } from './src/parser';
import * as fs from 'fs';

const source = fs.readFileSync('test-fixtures/test-case-10.stm', 'utf-8');
const lexer = new Lexer(source);
const tokens = lexer.tokenize();

console.log('Tokens from line 10:');
tokens.filter(t => t.line === 10).forEach(t => console.log(`  ${t.type}: "${t.value}" (col ${t.column})`));

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log('\nParsed successfully!');
  console.log(`Definitions: ${ast.definitions.length}`);
  console.log(`Primary expression: ${ast.primaryExpression?.type}`);
  console.log(`Contingencies: ${ast.contingencies.length}`);
} catch (e: any) {
  console.log('\nError:', e.message);
}
