#!/bin/bash

# Frontend Deployment Script for Vercel
# This script builds and deploys the frontend to Vercel

set -e  # Exit on error

echo "🚀 Starting frontend deployment..."

# Step 1: Build the frontend
echo "📦 Building frontend..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Step 2: Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Step 3: Check if logged in
echo "🔐 Checking Vercel authentication..."
if ! vercel whoami &> /dev/null; then
    echo "⚠️  Not logged in to Vercel. Please login:"
    vercel login
fi

# Step 4: Verify environment variables
echo "🔍 Checking environment variables..."
echo "Current environment variables:"
vercel env ls

echo ""
echo "⚠️  Make sure this environment variable is set:"
echo "  - VITE_API_BASE_URL (production)"
echo ""
read -p "Press Enter to continue with deployment..."

# Step 5: Deploy (--force skips build cache for clean deploy)
echo "🚀 Deploying to Vercel (clean deploy, no cache)..."
VERCEL_FORCE_NO_BUILD_CACHE=1 vercel --prod --force

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🌐 Your frontend should be available at the URL shown above"
else
    echo "❌ Deployment failed!"
    exit 1
fi
