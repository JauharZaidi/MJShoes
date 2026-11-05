#!/bin/bash
set -e

# Production Deployment Guardian Script
# Natively executes safe boundaries for rolling environments

echo "🚀 Initiating Zero-Downtime Deployment Sequence..."

echo "📦 1. Resolving Native Dependencies"
npm ci --omit=dev
npm ci --omit=dev --prefix server

echo "🗺️  2. Regenerating Sitemap from Live Product Catalog"
node server/generate-sitemap.js

echo "⚒️  3. Building Frontend Distribution"
npm run build

echo "🔄 4. Swapping Clusters via PM2"
# Maps explicitly to the ecosystem configuration executing zero-downtime reloads
# Wait_ready inherently ensures port bounds don't orphan HTTP traffic
pm2 reload server/ecosystem.config.cjs

echo "📊 5. Validating Application State bounds"
sleep 5
pm2 status

echo "✅ Deployment Terminated Gracefully!"
