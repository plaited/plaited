FROM  mcr.microsoft.com/playwright:v1.35.1-jammy

RUN npm install -g bun

# Install Playwright dependencies
RUN bunx playwright install

RUN git config --global --add safe.directory /workspaces/plaited