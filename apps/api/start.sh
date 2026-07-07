#!/bin/bash
# Start the Griot API locally
cd "$(dirname "$0")"
cp -n .env.example .env 2>/dev/null
npm install --silent
echo "Starting Griot API..."
node src/index.js
