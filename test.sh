#!/bin/bash

# Bun Install
bun install

# Run yarn build
npm run build --workspaces --if-present

# Playwright download browsers
npx playwright install  

# Run test
npm run test --workspaces --if-present
