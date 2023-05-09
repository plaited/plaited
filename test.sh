#!/bin/bash

# Install and link dependencies
bun install

# Run build
bun run build

# Playwright download browsers
npx playwright install  

# Run test
bun run test
