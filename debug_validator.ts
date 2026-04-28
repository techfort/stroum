import { Lexer } from './src/lexer';
import { Parser } from './src/parser';
import { Validator } from './src/validator';

function validate(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const validator = new Validator();
  return validator.validate(ast);
}

const source = `f:parse raw ~> @"ok", @"fail" =>
  json_parse(raw) @"ok"
  | .fail => @"fail"

f:transform data ~> @"clean", @"rejected" =>
  data |> normalise |> validate @"clean"
  | .invalid => @"rejected"

fetch(primary) PP fetch(secondary) |> merge @"data"

on @"errors" |> |:e| => log(e)`;

const issues = validate(source);
console.log(JSON.stringify(issues, null, 2));
