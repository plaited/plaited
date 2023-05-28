#!/bin/bash

# Install and link dependencies
bun install

# Install playwright dependencies
npx playwright install

# Run build
bun run build 

# Run test
bun run test
