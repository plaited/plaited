---
name: world-agent
description: Train and deploy generative UI agents using behavioral programming constraints and RL training. Use when working with agent training, trajectory generation, reward computation, or deploying models to HuggingFace.
license: Apache-2.0
compatibility: Requires @huggingface/inference, Bun >= 1.2.9, Google Colab for training
---

# World Agent

## Purpose

This skill provides guidance for training and deploying generative UI agents that use behavioral programming for coordination. The world agent generates templates, stories, and bThreads via structured function calls, learning from story execution feedback.

**Use this when:**
- Training agents with GRPO on Google Colab
- Generating training trajectories from stories
- Computing rewards from story execution results
- Deploying models to HuggingFace Inference Endpoints
- Adding custom tools or constraints to the agent

## Key Architectural Concept

**The agent IS a bProgram, not a class.**

Unlike HuggingFace tiny-agents which use async generator loops, Plaited's world agent uses `useBehavioral` where bThreads act as runtime constraints that block invalid generations BEFORE tool execution.

```typescript
import { useWorldAgent, createCoreTools } from 'plaited/agent'

const trigger = await useWorldAgent({
  tools: createCoreTools({ outputDir: './generated' }),
  model: inferenceClient
})

trigger({ type: 'generate', detail: { intent: 'Create a button' } })
```

## Quick Reference

| Task | Resource |
|------|----------|
| Training workflow | [training-workflow.md](references/training-workflow.md) |
| Tool API | [tool-api.md](references/tool-api.md) |
| Generate trajectories | `scripts/generate-trajectories.ts` |
| Compute rewards | `scripts/compute-rewards.ts` |

## Package Exports

```typescript
// Agent factory
import { useWorldAgent } from 'plaited/agent'

// Tool infrastructure
import { createToolRegistry, createCoreTools } from 'plaited/agent'

// Constraints
import {
  createEnforceTokenUsage,
  createEnforceAccessibility,
  registerBaseConstraints
} from 'plaited/agent'

// Training utilities
import {
  computeReward,
  createTrajectory,
  generateTrajectories
} from 'plaited/agent'
```

## Training Overview

### Phase 1: Generate Trajectories

Run existing stories to collect execution traces:

```bash
bun scripts/generate-trajectories.ts src/templates --output trajectories.jsonl
```

### Phase 2: Train on Colab

See [training-workflow.md](references/training-workflow.md) for complete Colab notebook.

```python
from unsloth import FastLanguageModel
from trl import GRPOConfig, GRPOTrainer

# Load FunctionGemma with Unsloth
model, tokenizer = FastLanguageModel.from_pretrained("google/gemma-function-calling")

# Train with GRPO
trainer = GRPOTrainer(model=model, config=grpo_config, train_dataset=trajectories)
trainer.train()

# Push to HuggingFace
model.push_to_hub("username/plaited-world-agent-lora")
```

### Phase 3: Deploy

Deploy to HuggingFace Inference Endpoints with vLLM, then connect:

```typescript
import { InferenceClient } from '@huggingface/inference'

const client = new InferenceClient(process.env.HF_TOKEN)
const trigger = await useWorldAgent({
  tools: createCoreTools({ outputDir: './generated' }),
  model: {
    chatCompletion: (args) => client.chatCompletion({
      ...args,
      model: 'username/plaited-world-agent',
      endpointUrl: 'https://xxx.endpoints.huggingface.cloud'
    })
  }
})
```

## Adding Custom Tools

```typescript
import { createToolRegistry } from 'plaited/agent'

const registry = createToolRegistry()

registry.register('customTool', async (args) => {
  // Tool implementation
  return { success: true, data: result }
}, {
  name: 'customTool',
  description: 'What this tool does',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input parameter' }
    },
    required: ['input']
  }
})
```

## Adding Custom Constraints

```typescript
import { bThread, bSync } from 'plaited'

// Create a constraint bThread
const enforceNamingConvention = bThread([
  bSync({
    block: (event) => {
      if (event.type !== 'toolResult') return false
      const { name, result } = event.detail
      if (name !== 'writeTemplate') return false
      // Block if filename doesn't match convention
      return !result.data?.path?.match(/^[a-z-]+\.tsx$/)
    }
  })
], true)

// Register with bThreads
bThreads.set({ enforceNamingConvention })
```

## Reward Computation

Default weights:
- Story pass/fail: 50%
- Accessibility: 30%
- Assertion ratio: 20%

```typescript
import { computeReward } from 'plaited/agent'

const reward = computeReward(storyResult, {
  storyWeight: 0.5,
  a11yWeight: 0.3,
  assertionWeight: 0.2
})
```

## Related Skills

- **plaited-behavioral-core** - bProgram patterns, bThread composition
- **plaited-ui-patterns** - Templates, stories, styling
- **workbench** - Story discovery and preview
- **plaited-standards** - Code conventions
