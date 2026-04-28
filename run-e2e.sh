#!/bin/bash
# Stroum E2E Test Runner

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║            STROUM TRANSPILER - E2E TEST RUNNER                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# 1. Run all unit tests
echo "📋 Step 1: Running unit tests..."
npm test 2>&1 | tail -5
echo ""

# 2. Compile a Stroum program
echo "📋 Step 2: Compiling Stroum source..."
npm run dev -- compile test-fixtures/test-case-10.stm -o test-fixtures/test-case-10.ts 2>&1 | grep -E "Phase|Output|Runtime"
echo ""

# 3. Show generated code snippet
echo "📋 Step 3: Generated TypeScript (first 15 lines)..."
head -15 test-fixtures/test-case-10.ts
echo "   ... (see test-fixtures/test-case-10.ts for full output)"
echo ""

# 4. Run the executable demo
echo "📋 Step 4: Running executable demo..."
node examples/demo.js
echo ""

echo "✅ E2E pipeline complete!"
