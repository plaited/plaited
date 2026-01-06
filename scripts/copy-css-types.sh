#!/bin/bash

# Define source and target files
CSS_SRC="node_modules/csstype/index.d.ts"
CSS_DEST="src/ui/types/css.d.ts"

# Check if source files exist
if [ ! -f "$CSS_SRC" ]; then
  echo "Error: $CSS_SRC file missing."
  exit 1
fi

cp "$CSS_SRC" "$CSS_DEST"
