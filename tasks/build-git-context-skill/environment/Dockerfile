FROM oven/bun:1

# git powers the fixture builder and the verifier's truth recomputation;
# jq powers the verifier's JSON assertions. Build-time network only — the
# runtime baseline for this task is no-network (fully hermetic).
RUN apt-get update \
  && apt-get install -y --no-install-recommends git jq \
  && rm -rf /var/lib/apt/lists/*

# Fixture repos are built and read by the same root user; silence the
# dubious-ownership check so the CLI under test can always read them.
RUN git config --system --add safe.directory '*'

WORKDIR /app

# Agent-facing contract, discovered at /app/SPEC.md
COPY SPEC.md /app/SPEC.md

# Deterministic git-repo fixture builder. The verifier invokes it at grading
# time to rebuild a fresh repo and recompute expected values from git; the
# agent may also use it for self-testing.
COPY fixtures/build-git-fixture.sh /opt/fixtures/build-git-fixture.sh
RUN chmod +x /opt/fixtures/build-git-fixture.sh

# Neutral git identity so ad-hoc commits the agent makes while testing never
# leak a personal identity into fixture output.
RUN git config --global user.name "Sandbox Agent" \
  && git config --global user.email "agent@sandbox.local"
