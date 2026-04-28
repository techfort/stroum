# Stroum Language Support for VS Code

Syntax highlighting and language support for the Stroum programming language.

## Features

- **Syntax Highlighting**: Full syntax highlighting for all Stroum language constructs
- **Snippets**: Common code patterns for faster development
- **Bracket Matching**: Auto-closing brackets and quotes
- **Comment Support**: Line comments with `--`

## Syntax Highlighting

The extension provides syntax highlighting for:

- **Keywords**: `rec`, `on`, `ret`
- **Sigils**: `f:`, `b:`, `s:`
- **Operators**: `|>`, `|?>`, `=>`, `->`, `~>`, `@`, `@>`, `PP`, `XX`
- **Stream names**: `@"stream_name"`
- **Lambda expressions**: `|:param|`
- **Comments**: `-- comment`
- **Strings**: `"text"`
- **Numbers**: `42`, `3.14`
- **Booleans**: `true`, `false`
- **Type names**: Capitalized identifiers like `User`, `Payload`
- **Function names**: Highlighted when followed by `(`

## Snippets

Type these prefixes and press Tab:

| Prefix | Description |
|--------|-------------|
| `fn` | Function definition |
| `fnm` | Function with multiple parameters |
| `pipe` | Pipe chain |
| `match` | Outcome match |
| `on` | Stream handler |
| `lambda` | Lambda expression |
| `pp` | Parallel composition |
| `emit` | Stream emit |
| `bind` | Binding |
| `struct` | Struct definition |

## Installation

### Option 1: Install from folder

1. Copy to VS Code extensions directory:
   ```bash
   cp -r vscode-stroum ~/.vscode/extensions/stroum-1.0.0
   ```

2. Reload VS Code:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Reload Window" and press Enter

3. Open any `.stm` file to see syntax highlighting!

### Option 2: Package and install (requires vsce)

```bash
cd vscode-stroum
npm install -g vsce
vsce package
code --install-extension stroum-1.0.0.vsix
```

## Example

Here's how Stroum code looks with syntax highlighting:

```stroum
-- This is a comment
f:double x => mul(x, 2)

f:add a b => plus(a, b)

f:process_data data =>
  data
    |> validate()
    |> transform()
  | .ok    => save() @ "success"
  | .error => log() @ "errors"

on @"success" |> |:result| => print(result)
on @"errors" |> |:err| => report_error(err)
```

### Highlighted Elements

- **Comments** (gray): `-- This is a comment`
- **Sigils** (purple/keyword): `f:`, `b:`, `s:`
- **Keywords** (purple): `rec`, `on`, `ret`
- **Operators** (red/blue): `|>`, `=>`, `@`
- **Strings** (orange): `"success"`, `"errors"`
- **Stream names** (orange): `@"success"`
- **Type names** (cyan): `User`, `Response`
- **Functions** (yellow): `validate()`, `transform()`
- **Lambda params** (blue): `|:result|`

## Language Features

### Comment Toggling

- Press `Ctrl+/` (or `Cmd+/` on Mac) to toggle line comments
- Comments use `--` prefix (Stroum style)

### Bracket Matching

- Auto-closes: `()`, `{}`, `[]`, `""`
- Highlights matching brackets
- Jump between brackets with `Ctrl+Shift+\`

### Code Folding

- Fold regions with `-- region` and `-- endregion` markers
- Example:
  ```stroum
  -- region Helper Functions
  f:helper1 x => x
  f:helper2 x => x
  -- endregion
  ```

## Troubleshooting

### Syntax highlighting not working

1. Check file extension is `.stm`
2. Reload VS Code: `Ctrl+Shift+P` → "Reload Window"
3. Check VS Code version is 1.74.0 or higher

### Snippets not working

1. Make sure you're in a `.stm` file
2. Type the snippet prefix (e.g., `fn`)
3. Press `Tab` (not Enter)

### Extension not appearing

1. Check extension is installed: `~/.vscode/extensions/stroum-1.0.0`
2. Restart VS Code completely
3. Check for extension errors: `Ctrl+Shift+P` → "Developer: Show Logs"

## Development

To modify this extension:

1. Edit files in the `vscode-stroum` folder
2. Copy to extensions: `cp -r vscode-stroum ~/.vscode/extensions/stroum-1.0.0`
3. Reload VS Code to see changes

### Files

- `package.json` - Extension metadata and configuration
- `language-configuration.json` - Language features (brackets, comments)
- `syntaxes/stroum.tmLanguage.json` - TextMate grammar for syntax highlighting
- `snippets/stroum.json` - Code snippets

## Contributing

Found an issue or want to improve the extension? 

- Report issues on the [Stroum repository](https://github.com/yourusername/stroum)
- Submit pull requests with improvements

## License

MIT

## About Stroum

Stroum is a functional, pipe-first, stream-oriented programming language that compiles to TypeScript.

Learn more:
- [Stroum Documentation](../README.md)
- [Language Specification](../PHASE4-COMPLETE.md)
- [Standard Library](../stdlib/README.md)
