# Training Workflow

Complete guide for training the world agent using Unsloth + GRPO on Google Colab.

## Prerequisites

- Google account (for Colab)
- HuggingFace account with access token
- Generated trajectories (JSONL format)

## Overview

```
Local Development          Google Colab              HuggingFace
─────────────────         ─────────────             ────────────

Generate trajectories ───► Upload JSONL ───► Train with GRPO
                                                    │
                                                    ▼
Connect InferenceClient ◄─ Deploy Endpoint ◄─ push_to_hub()
```

## Step 1: Generate Trajectories (Local)

Run the trajectory generation script on your training stories:

```bash
# Generate trajectories from training stories
bun .claude/skills/world-agent/scripts/generate-trajectories.ts \
  training/stories \
  --output training/trajectories.jsonl

# Filter to high-quality examples (reward >= 0.7)
bun .claude/skills/world-agent/scripts/compute-rewards.ts \
  training/trajectories.jsonl \
  --min-reward 0.7 \
  --output training/trajectories.jsonl
```

### Trajectory Format

Trajectories use **FunctionGemma format** for function calls (not JSON):

```json
{
  "messages": [
    {"role": "system", "content": "You are a UI generation agent..."},
    {"role": "user", "content": "Create a primary button"},
    {"role": "assistant", "content": "<start_function_call>call:writeTemplate{path:<escape>button.tsx<escape>,content:<escape>export const Button = ...<escape>}<end_function_call>"}
  ],
  "reward": 0.85,
  "storyResult": {
    "passed": true,
    "a11yPassed": true,
    "totalAssertions": 5,
    "passedAssertions": 5
  }
}
```

**Parsing model responses:**
```typescript
import { parseFunctionGemmaOutput } from 'plaited/agent'

const calls = parseFunctionGemmaOutput(response.content)
// Returns: [{ name: 'writeTemplate', arguments: '{"path":"button.tsx",...}' }]
```

## Step 2: Colab Notebook Setup

Create a new Colab notebook and run the following cells:

### Cell 1: Install Dependencies

```python
!pip install unsloth
!pip install --upgrade trl transformers datasets
```

### Cell 2: Login to HuggingFace

```python
from huggingface_hub import login
login(token="hf_your_token_here")  # Or use Colab secrets
```

### Cell 3: Load Model with Unsloth

```python
from unsloth import FastLanguageModel

# FunctionGemma 270M - optimized for function calling
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="google/functiongemma-270m-it",
    max_seq_length=2048,
    dtype=None,  # Auto-detect
    load_in_4bit=True,  # Use 4-bit quantization for memory efficiency
)

# Add LoRA adapters
model = FastLanguageModel.get_peft_model(
    model,
    r=16,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=42,
)
```

### Cell 4: Load Training Data

```python
from datasets import load_dataset

# Upload training/trajectories.jsonl to Colab or load from HuggingFace
dataset = load_dataset("json", data_files="trajectories.jsonl", split="train")

def format_for_training(example):
    """Format trajectory for GRPO training."""
    messages = example["messages"]
    reward = example["reward"]

    # Format as chat template
    text = tokenizer.apply_chat_template(messages, tokenize=False)

    return {
        "text": text,
        "reward": reward
    }

dataset = dataset.map(format_for_training)
```

### Cell 5: Configure GRPO Training

```python
from trl import GRPOConfig, GRPOTrainer

config = GRPOConfig(
    output_dir="./grpo-output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-5,
    warmup_ratio=0.1,
    logging_steps=10,
    save_steps=100,
    fp16=True,

    # GRPO specific
    beta=0.1,  # KL penalty coefficient
    max_new_tokens=512,
)

trainer = GRPOTrainer(
    model=model,
    config=config,
    train_dataset=dataset,
    tokenizer=tokenizer,
)
```

### Cell 6: Train

```python
trainer.train()
```

### Cell 7: Save and Push to Hub

```python
# Save locally first
model.save_pretrained("./plaited-world-agent-lora")
tokenizer.save_pretrained("./plaited-world-agent-lora")

# Push to HuggingFace Hub
model.push_to_hub(
    "your-username/plaited-world-agent-lora",
    token="hf_your_token_here"
)
tokenizer.push_to_hub(
    "your-username/plaited-world-agent-lora",
    token="hf_your_token_here"
)
```

## Step 3: Deploy to Inference Endpoints

### Option A: HuggingFace Inference Endpoints (Recommended)

1. Go to [huggingface.co/endpoints](https://huggingface.co/endpoints)
2. Click "New Endpoint"
3. Select your model: `your-username/plaited-world-agent-lora`
4. Choose:
   - Instance: GPU (T4 or better)
   - Container: vLLM
   - Security: Protected (requires token)
5. Deploy and copy the endpoint URL

### Option B: Merge and Deploy Full Model

```python
# Merge LoRA into base model
merged_model = model.merge_and_unload()

# Push merged model
merged_model.push_to_hub_merged(
    "your-username/plaited-world-agent",
    tokenizer,
    save_method="merged_16bit",
    token="hf_your_token_here"
)
```

## Step 4: Connect to Agent (Local)

```typescript
import { InferenceClient } from '@huggingface/inference'
import { useWorldAgent, createCoreTools } from 'plaited/agent'

const client = new InferenceClient(process.env.HF_TOKEN)

const trigger = await useWorldAgent({
  tools: createCoreTools({
    outputDir: './generated',
    runStory: async (path) => {
      // Connect to your story runner
      return await runStoryTest(path)
    }
  }),
  model: {
    chatCompletion: async (args) => {
      const response = await client.chatCompletion({
        model: 'your-username/plaited-world-agent',
        endpointUrl: 'https://xxx.endpoints.huggingface.cloud',
        messages: args.messages,
        tools: args.tools?.map(t => ({
          type: 'function',
          function: t
        }))
      })

      return {
        tool_calls: response.choices[0]?.message?.tool_calls?.map(tc => ({
          name: tc.function.name,
          arguments: tc.function.arguments
        }))
      }
    }
  }
})

// Now use the agent
trigger({
  type: 'generate',
  detail: { intent: 'Create a primary button with hover state' }
})
```

## Iteration Cycle

```
1. Generate trajectories from stories
         ↓
2. Train on Colab (GRPO)
         ↓
3. Deploy updated model
         ↓
4. Test agent on new prompts
         ↓
5. Add failing cases to story tests
         ↓
6. Re-generate trajectories
         ↓
   (Repeat from step 2)
```

## Troubleshooting

### Out of Memory on Colab

- Use `load_in_4bit=True` (already set)
- Reduce `per_device_train_batch_size` to 2 or 1
- Increase `gradient_accumulation_steps` to compensate
- Use Colab Pro for more RAM

### Model Not Generating Tools

- Check tool schema format matches training data
- Ensure system prompt includes tool descriptions
- Try increasing temperature slightly (0.7)

### push_to_hub Fails

- Verify HF token has write access
- Check if `model.safetensors.index.json` uploaded (known bug)
- Manually upload missing files if needed

## Cost Estimate

| Resource | Cost | Duration |
|----------|------|----------|
| Colab Free | $0 | Limited GPU time |
| Colab Pro | $10/mo | Faster GPUs, more time |
| HF Inference Endpoint | ~$0.60/hr (T4) | Pay per use |

For a 270M parameter model like FunctionGemma:
- Training: ~30 minutes on T4
- Inference: ~100-300 tokens/second
