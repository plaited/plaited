#!/bin/bash

# Install and link dependencies
bun install

# Install Playwright dependencies
bunx playwright install --with-deps

# Run build
bun run build 

# Run test
bun run test
