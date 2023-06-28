#!/bin/bash

# Install and link dependencies
yarn install

# Install Playwright dependencies
npx playwright install

# Run build
yarn run build 

# Run test
yarn run test
