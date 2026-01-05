#!/bin/bash
# Deploy script for Fly.io backend

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to backend directory
cd "$SCRIPT_DIR"

echo "Current directory: $(pwd)"
echo "Deploying to Fly.io..."

# Deploy
fly deploy --app seven-dash


