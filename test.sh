#!/bin/bash

# Yarn installl
yarn install --immutable

# Bun Install
bun install

# Run yarn build
yarn build

# Run test
yarn test
