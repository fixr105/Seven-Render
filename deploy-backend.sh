#!/bin/bash

# Backend Deployment Script for Fly.io
# This script builds and deploys the backend to Fly.io

set -e  # Exit on error

echo "🚀 Starting backend deployment..."

# Navigate to backend directory
cd backend

# Step 1: Build the backend
echo "📦 Building backend..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Step 2: Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo "⚠️  flyctl not found. Installing..."
    curl -L https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
fi

# Step 3: Check if logged in
echo "🔐 Checking Fly.io authentication..."
if ! flyctl auth whoami &> /dev/null; then
    echo "⚠️  Not logged in to Fly.io. Please login:"
    flyctl auth login
fi

# Step 4: Verify environment variables
echo "🔍 Checking environment variables..."
echo "Current secrets:"
flyctl secrets list

echo ""
echo "⚠️  Make sure these secrets are set:"
echo "  - N8N_BASE_URL"
echo "  - JWT_SECRET"
echo "  - CORS_ORIGIN (or CORS_ORIGIN)"
echo "  - TEST_EMAIL_PATTERNS (optional)"
echo "  - ALLOWED_TEST_EMAILS (optional)"
echo "  - TEST_NAME_PATTERNS (optional)"
echo ""
read -p "Press Enter to continue with deployment..."

# Step 5: Deploy
echo "🚀 Deploying to Fly.io..."
flyctl deploy

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🔍 Verifying deployment..."
    flyctl status
    echo ""
    echo "📊 Check logs:"
    echo "   flyctl logs"
    echo ""
    echo "🌐 Your backend should be available at:"
    flyctl status | grep "Hostname" || echo "   Check Fly.io dashboard for URL"
else
    echo "❌ Deployment failed!"
    exit 1
fi
