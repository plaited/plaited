#!/bin/bash

# Install and link dependencies
bun install

# Install playwright dependencies
bun playwright install

# Run build
bun run build 

# Run test
bun run test
