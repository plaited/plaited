#!/bin/bash
#!/bin/bash

# Define source and target files
AXE_SRC="node_modules/axe-core/axe.d.ts"
AXE_DEST="src/assert/types/axe.d.ts"
CSS_SRC="node_modules/csstype/index.d.ts"
CSS_DEST="src/css/types/css.d.ts"

# Check if source files exist
if [ ! -f "$AXE_SRC" ]; then
  echo "Error: $AXE_SRC file missing."
  exit 1
fi

if [ ! -f "$CSS_SRC" ]; then
  echo "Error: $CSS_SRC file missing."
  exit 1
fi

# Copy files to target locations
cp "$AXE_SRC" "$AXE_DEST"
cp "$CSS_SRC" "$CSS_DEST"