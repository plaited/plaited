#!/bin/bash

# Install and link dependencies
bun install

# Run build
npm run build --workspaces --if-present

# Playwright download browsers
npx playwright install  

# Run test
npm run test --workspaces --if-present
