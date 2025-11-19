#!/usr/bin/env bash
set -e

echo "🔨 Building Plaited CLI bundle..."
echo ""

# Create output directory
mkdir -p .bin

# Bundle the CLI using Bun CLI
bun build ./src/workshop/cli.ts \
  --outfile ./.bin/plaited.js \
  --target bun \
  --format esm \
  --external playwright

# Make bundle executable
chmod +x ./.bin/plaited.js

# Report file size
SIZE=$(du -h ./.bin/plaited.js | cut -f1)
echo ""
echo "📦 Output: .bin/plaited.js"
echo "📊 Size: $SIZE"
echo ""
echo "✨ Build complete!"
