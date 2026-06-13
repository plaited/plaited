# ICL Analyst Reference

How the Gemma 4 E2B analyst generates in-context learning (ICL)
instructions for the Gemma 4 26B A4B executor.

## Core Principle

> In-context learning (ICL) is a machine learning technique in which a large
> language model (LLM) makes predictions based on context provided in the
> input, without requiring additional training or fine-tuning of the model's
> parameters.
>
> — [IBM Think, In-Context Learning](https://www.ibm.com/think/topics/in-context-learning)

The executor's weights are **frozen**. Its behavior changes only when
the analyst's output (embedded in the executor's prompt) changes.

## Analyst Prompt (Deterministic)

```
system: You are a OnBraid analyst. Given the current OnBraid context
(patterns, objectives, prior events, available packages), produce
concise, structured instructions that a coding agent should follow
to accomplish the user's task.

user:
<onbraid_context>
{
  "patterns": ["editor.selection-change", "state.sync", "ui.render"],
  "objectives": ["Enable reactive state binding for editor topic"],
  "priorEvents": [...],
  "availablePackages": [...]
}
</onbraid_context>

Task: "Add a reactive selector that syncs editor selection state with
      the global store when the topic is 'editor:focused'."
```

## Analyst Output (Structured ICL Payload)

```json
{
  "objective": "Implement reactive state selector for editor topic",
  "patterns_to_apply": ["editor.selection-change", "state.sync"],
  "constraints": [
    "No direct DOM access in behavioral specs",
    "Use thread `editorFocus` for coordination",
    "Emit `state.sync` after selection stabilizes"
  ],
  "expected_acp_payload_shape": {
    "type": "agent_prompt",
    "target": "coder",
    "payload": {
      "specs": ["array of Spec objects"],
      "bindings": ["array of UiCapabilityBinding"]
    }
  },
  "verification_checklist": [
    "L1: All specs parse as valid Zod schema",
    "L2: No deadlock in behavioral frontier",
    "L3: Mock MCP calls succeed in isolated BP engine",
    "L4: ACP round to coder model returns success",
    "L5: `bun test` passes on generated code"
  ]
}
```

## Executor Prompt (Creative + Tool-Enabled)

```
system: You are a OnBraid coding agent. You have access to OnBraid
behavioral specs, MCP tools, and ACP protocol. Follow the analyst's
instructions precisely.

user:
<analyst_instructions>
{"objective":"...","patterns_to_apply":["..."],"constraints":["..."],...}
</analyst_instructions>

Task: "Add a reactive selector that syncs editor selection state with
the global store when the topic is 'editor:focused'."
```

## Design Choices

| Decision | Rationale |
|----------|-----------|
| **Low temperature on analyst (0.3)** | Deterministic, reproducible instructions |
| **Higher temperature on executor (0.7)** | Creative generation within constraints |
| **JSON output from analyst** | Structured, parseable, easy to validate |
| **No tools on analyst** | Analyst is a pure text generator; executor handles all tool calls |
| **Frozen executor** | No training cost, no memory overhead, immediate ICL style updates |

## Why ICL instead of LoRA on the 26B?

| Approach | Memory | Time | Flexibility |
|----------|--------|------|-------------|
| Full SFT on 26B | ~100 GB | Days | Locked to one style |
| LoRA on 26B | ~80 GB | Hours | Limited style capacity |
| **ICL via 2B analyst** | **~16 GB** | **Minutes** | **Style changes with prompt** |

## Training Data for Analyst

Each training pair is:

```
(analyst_prompt, analyst_output) → labeled by whether the executor,
when given that analyst_output as ICL, produced verifier-passing output.
```

Only **passing** trajectories become training data. The analyst learns
to produce ICL instructions that reliably steer the executor to correct
output.

## References

- [IBM Think: In-Context Learning](https://www.ibm.com/think/topics/in-context-learning)
- Gemma 4 E2B: 2B dense instruction-tuned model
- Gemma 4 26B A4B: 26B MoE, 4B active, with native tool-call parser
