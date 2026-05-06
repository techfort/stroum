# Stroum Color Customization Guide

The Stroum VS Code extension provides syntax highlighting with customizable colors for different language elements.

The extension now ships with a Nord-inspired default palette for Stroum scopes. That default comes from the extension manifest and only affects Stroum token colors, not the overall VS Code workbench theme.

## Available Scopes

The following TextMate scopes are available for customization:

### Definitions
- `entity.name.function.definition.stroum` - Function names after `f:` (e.g., `f:add`)
- `variable.other.binding.stroum` - Binding names after `b:` (e.g., `b:result`)
- `entity.name.type.struct.stroum` - Struct names after `s:` (e.g., `s:Person`)

### Sigils
- `keyword.operator.sigil.function.stroum` - The `f:` prefix
- `keyword.operator.sigil.binding.stroum` - The `b:` prefix
- `keyword.operator.sigil.struct.stroum` - The `s:` prefix
- `keyword.operator.sigil.import.stroum` - The `i:` prefix
- `keyword.operator.sigil.source.stroum` - The `src:` prefix
- `keyword.operator.sigil.sink.stroum` - The `to:` prefix

### Function Calls
- `entity.name.function.call.stroum` - Function names in expressions (e.g., `add` in `5 |> add(3)`)

### Other Elements
- `keyword.control.stroum` - Keywords like `rec`, `on`, `route`, `if`, `then`, `else`, `run`, `until`, `forever`, `signal`
- `keyword.operator.pipe.stroum` - Pipe operators `|>`, `|?>`
- `keyword.operator.arrow.stroum` - Arrow operators `=>`, `->`, `~>`
- `string.quoted.double.stroum` - String literals
- `constant.numeric.stroum` - Numbers
- `comment.line.double-dash.stroum` - Comments

## Customization Methods

### Built-in Default

The built-in Stroum palette is defined in `contributes.configurationDefaults` in the extension manifest. User and workspace `editor.tokenColorCustomizations` still override it.

### Method 1: VS Code Settings (Recommended)

Add color customizations to your VS Code `settings.json`:

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "Preferences: Open User Settings (JSON)"
3. Add the following configuration:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "entity.name.function.definition.stroum",
        "settings": {
          "foreground": "#DCDCAA",
          "fontStyle": "bold"
        }
      },
      {
        "scope": "variable.other.binding.stroum",
        "settings": {
          "foreground": "#9CDCFE",
          "fontStyle": "italic"
        }
      },
      {
        "scope": "entity.name.function.call.stroum",
        "settings": {
          "foreground": "#DCDCAA"
        }
      },
      {
        "scope": "keyword.operator.sigil.function.stroum",
        "settings": {
          "foreground": "#C586C0"
        }
      },
      {
        "scope": "keyword.operator.sigil.binding.stroum",
        "settings": {
          "foreground": "#569CD6"
        }
      }
    ]
  }
}
```

### Method 2: Workspace Settings

To apply colors only to the current workspace:

1. Open `.vscode/settings.json` in your workspace
2. Add the same `editor.tokenColorCustomizations` configuration

### Method 3: Theme-Specific Colors

To apply different colors per theme:

```json
{
  "editor.tokenColorCustomizations": {
    "[Dark+ (default dark)]": {
      "textMateRules": [
        {
          "scope": "entity.name.function.definition.stroum",
          "settings": {
            "foreground": "#DCDCAA"
          }
        }
      ]
    },
    "[Light+ (default light)]": {
      "textMateRules": [
        {
          "scope": "entity.name.function.definition.stroum",
          "settings": {
            "foreground": "#795E26"
          }
        }
      ]
    }
  }
}
```

### Method 4: Explicit Nord Override

If you want to pin the Nord palette in settings instead of relying on the extension default, use:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "entity.name.function.definition.stroum",
        "settings": {
          "foreground": "#88C0D0",
          "fontStyle": "bold"
        }
      },
      {
        "scope": "entity.name.function.call.stroum",
        "settings": {
          "foreground": "#88C0D0"
        }
      },
      {
        "scope": "variable.other.binding.stroum",
        "settings": {
          "foreground": "#8FBCBB",
          "fontStyle": "italic"
        }
      },
      {
        "scope": "entity.name.type.struct.stroum, entity.name.type.stroum",
        "settings": {
          "foreground": "#EBCB8B"
        }
      },
      {
        "scope": "keyword.control.stroum",
        "settings": {
          "foreground": "#81A1C1",
          "fontStyle": "bold"
        }
      },
      {
        "scope": "keyword.operator.sigil.function.stroum, keyword.operator.sigil.binding.stroum, keyword.operator.sigil.struct.stroum, keyword.operator.sigil.import.stroum, keyword.operator.sigil.source.stroum, keyword.operator.sigil.sink.stroum",
        "settings": {
          "foreground": "#5E81AC"
        }
      },
      {
        "scope": "keyword.operator.pipe.stroum, keyword.operator.arrow.stroum, keyword.operator.composition.stroum, keyword.operator.stream.stroum, keyword.operator.outcome.stroum, keyword.operator.lambda.stroum",
        "settings": {
          "foreground": "#B48EAD"
        }
      },
      {
        "scope": "string.quoted.double.stroum, string.quoted.module-path.stroum, string.quoted.stream.stroum",
        "settings": {
          "foreground": "#A3BE8C"
        }
      },
      {
        "scope": "constant.numeric.stroum, constant.language.boolean.stroum",
        "settings": {
          "foreground": "#D08770"
        }
      },
      {
        "scope": "comment.line.double-dash.stroum",
        "settings": {
          "foreground": "#616E88",
          "fontStyle": "italic"
        }
      },
      {
        "scope": "constant.character.escape.stroum",
        "settings": {
          "foreground": "#BF616A"
        }
      }
    ]
  }
}
```

## Example Color Schemes

### Vibrant Colors

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "entity.name.function.definition.stroum",
        "settings": {
          "foreground": "#FFD700",
          "fontStyle": "bold"
        }
      },
      {
        "scope": "variable.other.binding.stroum",
        "settings": {
          "foreground": "#7FFF00",
          "fontStyle": "italic"
        }
      },
      {
        "scope": "keyword.operator.sigil.function.stroum",
        "settings": {
          "foreground": "#FF1493"
        }
      },
      {
        "scope": "keyword.operator.sigil.binding.stroum",
        "settings": {
          "foreground": "#00BFFF"
        }
      }
    ]
  }
}
```

### Subtle/Minimal

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "entity.name.function.definition.stroum",
        "settings": {
          "foreground": "#B0B0B0"
        }
      },
      {
        "scope": "variable.other.binding.stroum",
        "settings": {
          "foreground": "#909090",
          "fontStyle": "italic"
        }
      },
      {
        "scope": "keyword.operator.sigil.function.stroum",
        "settings": {
          "foreground": "#707070"
        }
      }
    ]
  }
}
```

### Semantic Colors (Functional Programming Style)

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "entity.name.function.definition.stroum",
        "settings": {
          "foreground": "#61AFEF",
          "fontStyle": "bold"
        }
      },
      {
        "scope": "variable.other.binding.stroum",
        "settings": {
          "foreground": "#E06C75"
        }
      },
      {
        "scope": "entity.name.function.call.stroum",
        "settings": {
          "foreground": "#61AFEF"
        }
      },
      {
        "scope": "keyword.operator.pipe.stroum",
        "settings": {
          "foreground": "#C678DD",
          "fontStyle": "bold"
        }
      }
    ]
  }
}
```

## Testing Your Colors

After adding customizations:

1. Save your `settings.json`
2. Open a `.stm` file (e.g., `test-syntax.stm`)
3. Colors should update immediately
4. If not, reload VS Code: Command Palette → "Developer: Reload Window"

## Font Styles

Available font styles:
- `"bold"`
- `"italic"`
- `"bold italic"`
- `"underline"`
- `""` (normal)

## Finding Color Values

- Use VS Code's built-in color picker in `settings.json`
- Browse color palettes at [coolors.co](https://coolors.co)
- Check your theme's colors: Command Palette → "Developer: Inspect Editor Tokens and Scopes"

## Troubleshooting

**Colors not applying?**
1. Check JSON syntax in `settings.json`
2. Reload VS Code window
3. Verify scope names match exactly (case-sensitive)

**Want to see current scopes?**
1. Place cursor on a token
2. Command Palette → "Developer: Inspect Editor Tokens and Scopes"
3. View the TextMate scopes list

**Reset to defaults?**
Remove the `editor.tokenColorCustomizations` section from your `settings.json`.
