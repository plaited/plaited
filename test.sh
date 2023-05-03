#!/bin/bash

# Bun Install
bun install

# Run yarn build
npm run build --workspaces --if-present

# Run test
npm run test --workspaces --if-present
