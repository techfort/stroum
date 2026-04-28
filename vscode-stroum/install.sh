#!/bin/bash
# Install Stroum VS Code Extension

set -e

echo "📦 Installing Stroum VS Code Extension..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$HOME/.vscode/extensions/stroum-1.0.0"

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
  echo "⚠️  Warning: 'code' command not found. Make sure VS Code is installed."
  echo "   You can still install the extension manually."
  echo ""
fi

# Remove old version if exists
if [ -d "$EXT_DIR" ]; then
  echo "🗑️  Removing old version..."
  rm -rf "$EXT_DIR"
fi

# Create extensions directory if it doesn't exist
mkdir -p "$HOME/.vscode/extensions"

# Copy extension
echo "📋 Copying extension files..."
cp -r "$SCRIPT_DIR" "$EXT_DIR"

# Verify installation
if [ -d "$EXT_DIR" ]; then
  echo ""
  echo "✅ Stroum extension installed successfully!"
  echo ""
  echo "📁 Extension location: $EXT_DIR"
  echo ""
  echo "Files installed:"
  ls -la "$EXT_DIR" | grep -E '(json|stm)$' || true
  echo ""
  echo "Next steps:"
  echo "  1. Restart VS Code completely (close all windows)"
  echo "  2. Or run: code --list-extensions | grep stroum"
  echo "  3. Open any .stm file to see syntax highlighting"
  echo "  4. Check extensions: Ctrl+Shift+X and search for 'Stroum'"
  echo ""
  echo "To verify it's working:"
  echo "  code ${SCRIPT_DIR}/test-syntax.stm"
else
  echo ""
  echo "❌ Installation failed!"
  echo "   Please check permissions and try again."
  exit 1
fi
