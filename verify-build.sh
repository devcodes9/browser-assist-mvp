#!/bin/bash

echo "🔍 Verifying Browser Assist MVP Build..."
echo ""

# Check extension dist
echo "📦 Checking Extension Build..."
if [ -f "packages/extension/dist/manifest.json" ]; then
    echo "  ✅ manifest.json"
else
    echo "  ❌ manifest.json missing"
fi

if [ -f "packages/extension/dist/background.js" ]; then
    echo "  ✅ background.js"
else
    echo "  ❌ background.js missing"
fi

if [ -f "packages/extension/dist/content.js" ]; then
    echo "  ✅ content.js"
else
    echo "  ❌ content.js missing"
fi

if [ -f "packages/extension/dist/sidepanel.html" ]; then
    echo "  ✅ sidepanel.html"
else
    echo "  ❌ sidepanel.html missing"
fi

if [ -d "packages/extension/dist/assets" ]; then
    echo "  ✅ assets/ directory"
else
    echo "  ❌ assets/ directory missing"
fi

echo ""
echo "🔧 Checking Backend Build..."
if [ -f "packages/backend/dist/server.js" ]; then
    echo "  ✅ server.js"
else
    echo "  ❌ server.js missing"
fi

if [ -f "packages/backend/dist/agent.js" ]; then
    echo "  ✅ agent.js"
else
    echo "  ❌ agent.js missing"
fi

if [ -f "packages/backend/.env.example" ]; then
    echo "  ✅ .env.example"
else
    echo "  ❌ .env.example missing"
fi

echo ""
echo "📚 Checking Documentation..."
if [ -f "README.md" ]; then
    echo "  ✅ README.md"
fi
if [ -f "QUICKSTART.md" ]; then
    echo "  ✅ QUICKSTART.md"
fi
if [ -f "SETUP.md" ]; then
    echo "  ✅ SETUP.md"
fi
if [ -f "ARCHITECTURE.md" ]; then
    echo "  ✅ ARCHITECTURE.md"
fi
if [ -f "PROJECT_SUMMARY.md" ]; then
    echo "  ✅ PROJECT_SUMMARY.md"
fi

echo ""
echo "✨ Verification complete!"
echo ""
echo "Next steps:"
echo "1. Configure: cd packages/backend && cp .env.example .env"
echo "2. Add API key to .env"
echo "3. Load extension: chrome://extensions → Load unpacked → packages/extension/dist/"
echo "4. Start backend: npm run dev:backend"
