---
name: vllm
description: Check and start Plaited vLLM runtime servers for analyst and coder lanes.
license: ISC
compatibility: Requires bun and vllm
metadata:
  plaited:
    kind: skill
    origin:
      kind: first-party
    capabilities:
      - id: runtime.vllm
        type: cli
        lane: private
        phase: execution
        audience: [coder]
        actions: [health, serve]
        sideEffects: service
        handler:
          type: cli
          command: scripts/vllm.ts
        source:
          type: first-party
---

# vLLM

Use this skill to check or start local Plaited vLLM runtime servers.

## Usage

```bash
bun run skills/vllm/scripts/vllm.ts --schema input
bun run skills/vllm/scripts/vllm.ts '{"mode":"health","runtime":"analyst"}'
```
