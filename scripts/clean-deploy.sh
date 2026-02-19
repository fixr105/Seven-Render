#!/bin/bash
# Clean deploy for lms.sevenfincorp.com
# Fixes: old pages loading, updates not reflecting (browser/CDN cache)
#
# Usage: ./scripts/clean-deploy.sh
#
# What it does:
# 1. Skips Vercel build cache (fresh build)
# 2. Deploys with --force
# 3. New Cache-Control headers (in vercel.json) prevent index.html caching
#
# After deploy: Users may need hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
# or clear site data for lms.sevenfincorp.com if they still see old content.

set -e

echo "🧹 Clean deploy for lms.sevenfincorp.com"
echo "========================================"

# Ensure we're in project root
cd "$(dirname "$0")/.."

# Build (no cache)
echo ""
echo "📦 Building (fresh, no cache)..."
VERCEL_FORCE_NO_BUILD_CACHE=1 npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Deploy
echo ""
echo "🚀 Deploying to Vercel (--force skips build cache)..."
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI not found. Run: npm install -g vercel"
    exit 1
fi

VERCEL_FORCE_NO_BUILD_CACHE=1 vercel --prod --force

echo ""
echo "✅ Clean deploy complete!"
echo ""
echo "🌐 Site: https://lms.sevenfincorp.com"
echo ""
echo "If users still see old content:"
echo "  • Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)"
echo "  • Or: DevTools → Application → Clear site data"
echo ""
