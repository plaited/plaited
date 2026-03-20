# vLLM Setup for Native-Model Phase 2+

## Purpose

Run fine-tuned Falcon 7B locally on EdgeXpert for self-distillation cycles.

**Phase 1:** Codex CLI → judge → fine-tune Falcon
**Phase 2+:** Falcon (vLLM) → judge → fine-tune Falcon (self-improvement)

## Installation

```bash
# Install vLLM and dependencies
pip install vllm torch transformers

# For LoRA support (if using QLoRA fine-tuned models)
pip install peft
```

## Usage

### 1. Start vLLM Server

```bash
export VLLM_MODEL_PATH="./models/falcon-7b-native-model"
export VLLM_PORT=8000
export VLLM_GPU_MEMORY_UTILIZATION=0.85

bun scripts/vllm-server.ts
```

Server will start at `http://localhost:8000/v1`

### 2. Run Autoresearch with vLLM Adapter

In a separate terminal:

```bash
export VLLM_API_URL="http://localhost:8000/v1"
export VLLM_MODEL_NAME="falcon-7b"

bun run research:overnight -- ./dev-research/native-model/slice-2a.md \
  --adapter ./scripts/vllm-local-adapter.ts \
  --judge \
  --max-attempts 375
```

Or launch 8 workers in parallel:

```bash
for i in {a..h}; do
  bun run research:overnight -- ./dev-research/native-model/slice-2$i.md \
    --adapter ./scripts/vllm-local-adapter.ts \
    --judge \
    --max-attempts 375 &
done
wait
```

## Environment Variables

### Server (vllm-server.ts)

- `VLLM_MODEL_PATH`: Path to model checkpoint (required)
- `VLLM_PORT`: API server port (default: 8000)
- `VLLM_GPU_MEMORY_UTILIZATION`: GPU memory fraction 0-1 (default: 0.9)
- `VLLM_TENSOR_PARALLEL_SIZE`: Tensor parallel size (default: 1)

### Adapter (vllm-local-adapter.ts)

- `VLLM_API_URL`: vLLM API endpoint (default: http://localhost:8000/v1)
- `VLLM_MODEL_NAME`: Model name for API (default: falcon-7b)
- `VLLM_MAX_TOKENS`: Max completion tokens (default: 2048)
- `VLLM_TEMPERATURE`: Sampling temperature (default: 0.7)

## Hardware Requirements

**Minimum:**
- GPU with 40GB VRAM (Falcon 7B float16)
- EdgeXpert Grace Blackwell: ✓ (has 128GB unified memory)

**Recommended:**
- Quantized model (4-bit or 8-bit) if memory constrained
- Use `--gpu-memory-utilization 0.85` on EdgeXpert

## Model Paths

Fine-tuned models from Phase 1 (Slice 4):

```
./models/falcon-7b-native-model.qlora    # Phase 1 output
./models/falcon-7b-phase-2.qlora         # Phase 2 output
./models/falcon-7b-phase-3.qlora         # Phase 3 output
```

Point `VLLM_MODEL_PATH` to the checkpoint you want to serve.

## Troubleshooting

**"vLLM server unavailable"**
```bash
# Check if server is running
curl http://localhost:8000/v1/models
```

**"No completions returned"**
- Verify model is loaded in vLLM
- Check GPU memory with `nvidia-smi`
- Reduce `VLLM_MAX_TOKENS` if OOM

**Slow inference**
- Lower `VLLM_GPU_MEMORY_UTILIZATION` (reduces batch efficiency)
- Check GPU is not throttling (thermal limit)
- Use quantized model (4-bit) for speed/memory tradeoff

## Cost Analysis

**Phase 1 (Codex CLI):**
- Generation: $0 (subscription)
- Judging: ~$140-160 (Sonnet/Haiku)
- Total: ~$140-160/run

**Phase 2+ (vLLM + Falcon):**
- Generation: $0 (local)
- Judging: ~$140-160 (Sonnet/Haiku)
- Total: ~$140-160/run (same judging cost)
- Hardware: $6,900 (amortized)

**Advantage:** Eliminate Codex dependency for generation, enable true self-distillation.
