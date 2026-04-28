import re

content = open('src/parser.ts').read()

# 1. Fix parsePipeExpression return type
content = content.replace('private parsePipeExpression(): AST.Expression', 'private parsePipeExpression(): AST.PipeExpression')

# 2. Fix parsePipeExpression body - Remove the shortcut that return Expression instead of PipeExpression
# Earlier I might have messed it up with "if (false && ...)"
# Let's find the whole block and replace it correctly.
# The block looks like:
#    if (stages.length === 1 && !streamEmit && outcomeMatches.length === 0) {
#      return stages[0];
#    }
# Or mine:
#    if (false && stages.length === 1 && !streamEmit && outcomeMatches.length === 0) {
#      return stages[0];
#    }

content = re.sub(r'if \(.*stages\.length === 1 && !streamEmit && outcomeMatches\.length === 0\) \{\s+return stages\[0\];\s+\}', '', content)

# 3. Fix AST.ts - Change PipeExpression.stages and GatherPipe.target to allow Expression if needed, 
# but it is better to change CallExpression to be an Expression.
# Actually, the error is: Type 'Expression' is not assignable to type 'CallExpression'.
# Stages should be CallExpression[].

# Instead of changing parseCallExpression return type (which is hard because it returns many things),
# let's change AST.ts to be more permissive if it makes sense, OR wrap them in the parser.
