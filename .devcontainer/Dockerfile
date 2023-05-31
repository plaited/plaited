FROM  mcr.microsoft.com/playwright:v1.33.0-jammy

RUN npm install -g bun

# Install and link dependencies
RUN bun install

# Install Playwright dependencies
RUN bunx playwright install

# Run build
RUN bun run build 