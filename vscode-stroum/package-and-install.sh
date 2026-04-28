#!/bin/bash
# Package and Install Stroum VS Code Extension properly

set -e

echo "📦 Packaging Stroum VS Code Extension..."
echo ""

cd "$(dirname "$0")"

# Check for vsce
if ! command -v vsce &> /dev/null; then
  echo "⚙️  Installing vsce (VS Code Extension Manager)..."
  npm install -g @vscode/vsce
fi

# Clean old packages
rm -f *.vsix

echo "📝 Creating extension package..."
vsce package

# Find the vsix file
VSIX_FILE=$(ls -t *.vsix 2>/dev/null | head -1)

if [ -z "$VSIX_FILE" ]; then
  echo "❌ Failed to create .vsix package"
  exit 1
fi

echo ""
echo "✅ Package created: $VSIX_FILE"
echo ""

# Install the extension
echo "📥 Installing extension in VS Code..."
code --install-extension "$VSIX_FILE" --force

echo ""
echo "✅ Extension installed successfully!"
echo ""
echo "Installed extensions:"
code --list-extensions | grep -i stroum || echo "⚠️  Extension not showing yet (might need VS Code restart)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "NEXT STEPS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Close ALL VS Code windows"
echo "2. Restart VS Code"
echo "3. Open a .stm file:"
echo "   code test-syntax.stm"
echo ""
echo "4. Check bottom-right corner - should show 'Stroum' as language"
echo ""
echo "If syntax highlighting still doesn't work:"
echo "  • Click the language indicator (bottom-right)"
echo "  • Select 'Configure File Association for .stm'"
echo "  • Choose 'Stroum'"
echo ""
