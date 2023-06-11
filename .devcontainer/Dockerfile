FROM  mcr.microsoft.com/playwright:v1.34.3-jammy

RUN npm install -g bun

# Install Playwright dependencies
RUN bunx playwright install

RUN git config --global --add safe.directory /workspaces/plaited