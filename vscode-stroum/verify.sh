#!/bin/bash
# Verify Stroum VS Code Extension Installation

echo "🔍 Checking Stroum Extension Installation..."
echo ""

# Check VS Code installation
echo "1. Checking VS Code..."
if command -v code &> /dev/null; then
  echo "   ✅ VS Code 'code' command found"
  code --version
else
  echo "   ❌ VS Code 'code' command not found"
  echo "   Install with: https://code.visualstudio.com/docs/setup/linux"
fi

echo ""
echo "2. Checking extensions directory..."
if [ -d "$HOME/.vscode/extensions" ]; then
  echo "   ✅ Extensions directory exists: $HOME/.vscode/extensions"
  echo "   Found $(ls -1 "$HOME/.vscode/extensions" | wc -l) extensions"
else
  echo "   ❌ Extensions directory not found"
  echo "   Creating: $HOME/.vscode/extensions"
  mkdir -p "$HOME/.vscode/extensions"
fi

echo ""
echo "3. Checking Stroum extension..."
EXT_DIR="$HOME/.vscode/extensions/stroum-1.0.0"
if [ -d "$EXT_DIR" ]; then
  echo "   ✅ Stroum extension found at: $EXT_DIR"
  echo ""
  echo "   Files:"
  ls -la "$EXT_DIR" | head -20
  
  if [ -f "$EXT_DIR/package.json" ]; then
    echo ""
    echo "   ✅ package.json exists"
  else
    echo ""
    echo "   ❌ package.json missing!"
  fi
  
  if [ -f "$EXT_DIR/syntaxes/stroum.tmLanguage.json" ]; then
    echo "   ✅ Grammar file exists"
  else
    echo "   ❌ Grammar file missing!"
  fi
else
  echo "   ❌ Stroum extension not found at: $EXT_DIR"
  echo ""
  echo "   Run: ./install.sh"
fi

echo ""
echo "4. Checking installed extensions (if VS Code is available)..."
if command -v code &> /dev/null; then
  echo ""
  EXTENSIONS=$(code --list-extensions 2>/dev/null)
  if echo "$EXTENSIONS" | grep -i stroum > /dev/null; then
    echo "   ✅ Stroum extension is registered with VS Code!"
  else
    echo "   ⚠️  Stroum extension not showing in VS Code extensions list"
    echo ""
    echo "   All extensions:"
    code --list-extensions | head -10
  fi
fi

echo ""
echo "5. Testing with a .stm file..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/test-syntax.stm" ]; then
  echo "   ✅ Test file exists: test-syntax.stm"
  echo ""
  echo "   To test, run:"
  echo "   code $SCRIPT_DIR/test-syntax.stm"
else
  echo "   ❌ Test file not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TROUBLESHOOTING:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "If the extension doesn't show:"
echo "  1. Close ALL VS Code windows completely"
echo "  2. Run: ./install.sh"
echo "  3. Start VS Code fresh"
echo "  4. Open any .stm file"
echo "  5. Check bottom-right corner for language (should say 'Stroum')"
echo ""
echo "Alternative: Install from VSIX"
echo "  1. npm install -g vsce"
echo "  2. vsce package"
echo "  3. code --install-extension stroum-1.0.0.vsix"
echo ""
echo "Check for errors:"
echo "  Help → Toggle Developer Tools → Console tab"
echo ""
