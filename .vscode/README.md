# Running Stroum Files in VS Code

This workspace is configured with tasks to run and compile Stroum files directly from VS Code.

## Quick Start

### Method 1: Default Build Task (Recommended)
Press `Ctrl+Shift+B` (or `Cmd+Shift+B` on Mac) to run the current `.stm` file.

### Method 2: Command Palette
1. Open Command Palette: `Ctrl+Shift+P` (or `Cmd+Shift+P`)
2. Type: `Tasks: Run Task`
3. Select: `Run Current Stroum File`

### Method 3: Terminal Menu
- Click `Terminal` → `Run Build Task...`

## Available Tasks

### Run Current Stroum File (Default)
- **Shortcut**: `Ctrl+Shift+B` / `Cmd+Shift+B`
- **Command**: Executes the current `.stm` file using `stroum-run`
- **Output**: Shows in integrated terminal

### Compile Current Stroum File
- **Access**: Command Palette → `Tasks: Run Task` → `Compile Current Stroum File`
- **Command**: Transpiles the current `.stm` file to TypeScript
- **Output**: Shows compiled TypeScript code

## Custom Keyboard Shortcut (Optional)

To add a custom keyboard shortcut for running files:

1. Open Command Palette: `Ctrl+Shift+P`
2. Type: `Preferences: Open Keyboard Shortcuts (JSON)`
3. Add this binding:

```json
[
  {
    "key": "ctrl+alt+r",
    "command": "workbench.action.tasks.runTask",
    "args": "Run Current Stroum File",
    "when": "resourceExtname == .stm"
  }
]
```

Now pressing `Ctrl+Alt+R` will run the current `.stm` file (only when a `.stm` file is open).

## Troubleshooting

**Task not working?**
- Ensure you have the workspace open (not just a single file)
- Check that `stroum-run` script exists in the workspace root
- Make sure the file is saved before running

**Need to install Stroum CLI globally?**
```bash
npm run build
npm link
```

Then you can use `stroum run` command from anywhere.

## Example Workflow

1. Open a `.stm` file (e.g., `examples/first.stm`)
2. Edit your code
3. Press `Ctrl+Shift+B` to run
4. View output in the terminal

That's it! Happy coding! 🚀
