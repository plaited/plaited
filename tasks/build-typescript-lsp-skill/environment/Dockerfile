FROM oven/bun:1

# jq powers the verifier's JSON assertions. Build-time network only — the
# runtime baseline for this task is no-network (fully hermetic).
RUN apt-get update \
  && apt-get install -y --no-install-recommends jq \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pinned TypeScript 7 native preview. The agent's skill script — installed
# under /app/.agents/skills/typescript-lsp/scripts/ — resolves this through
# normal Node module resolution by importing `typescript/unstable/ast` and
# `typescript/unstable/async`. No network is available at trial time, so the
# dependency must be baked in here.
COPY package.json /app/package.json
RUN bun add --exact typescript@7.0.2

# Agent-facing contract, discovered at /app/SPEC.md
COPY SPEC.md /app/SPEC.md

# Static fixture file analyzed by both the agent's CLI and the verifier's
# truth script (which recomputes expectations from it at grading time).
COPY fixtures/sample.ts /opt/fixtures/sample.ts
