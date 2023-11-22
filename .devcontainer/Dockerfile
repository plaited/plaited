FROM  mcr.microsoft.com/playwright:v1.40.0-jammy

RUN npm install -g bun
RUN git config --global --add safe.directory /workspaces/plaited && \
  git remote add origin git@github.com:plaited/plaited.git