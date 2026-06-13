# DGX Spark / GB10 Unified Memory Guide

Quick reference for running dual-model vLLM on the NVIDIA GB10
Grace-Blackwell Superchip with 128 GB LPDDR5X unified memory.

## Architecture

- **CPU**: ARM64 Grace (20 Cortex-X925 cores)
- **GPU**: Blackwell (SM12.1)
- **Memory**: 128 GB LPDDR5X, CPU and GPU share one pool
- **Platform**: MSI EdgeXpert AI Mini Desktop, DGX OS (Ubuntu 24.04)

There is **no separate VRAM**. `nvidia-smi` reports "Not Supported" for GPU
memory usage because the kernel driver does not expose a discrete
framebuffer. The entire 128 GB is addressable by both Grace CPU and
Blackwell GPU.

## vLLM Memory Rationing on Unified Memory

vLLM pre-allocates GPU memory at startup:

```
requested = total_gpu_memory × gpu_memory_utilization
```

On GB10, "total GPU memory" = 128 GB. Two containers at 0.85 each =
218 GB requested → **OOM**.

## Recommended caps

| Model | Size | gpu-memory-utilization | Est. claimed | Notes |
|-------|------|----------------------|--------------|-------|
| Gemma 4 26B A4B | 26B MoE | 0.50 | ~64 GB | FP16 weights ~52 GB + KV + graphs |
| Gemma 4 E2B | 2B dense | 0.08 | ~10 GB | FP16 weights ~4 GB + tiny KV |
| Headroom | — | — | ~54 GB | OS, training spikes, KV growth |

Only raise utilization if the other model is stopped.

## GB10-Specific Docker Flags

Always include these when running vLLM on GB10:

```
--ipc=host                    # SHMEM > 64 MB needed by vLLM
--ulimit memlock=-1           # Pinned memory for CUDA
--ulimit stack=67108864       # Stack size for kernel launches
-e TORCH_CUDA_ARCH_LIST=12.1a # Target GB10 SM12.1
-e VLLM_FLASHINFER_MOE_BACKEND=latency  # throughput backend broken on SM12.1
```

## Why Docker is required (not optional)

| Problem | Why it matters |
|---------|---------------|
| ARM64 vLLM builds | Community wheels often x86-only |
| SM121 kernel support | CUTLASS, NCCL, FlashInfer need GB10 patches |
| Gemma 4 support | Added in vLLM 0.19+; NGC 26.02 has 0.15.1 |
| NVFP4 stability | NaN / DGX Spark fixes are 0.19-era |

The `vllm/vllm-openai:gemma4-cu130` image is the community container
with Gemma 4 + Blackwell fixes baked in. The `nvcr.io/nvidia/vllm:26.02`
image lacks all of the above.

## Context Length vs Memory Impact on GB10

| max-model-len | Memory Impact | Notes |
|---------------|---------------|-------|
| 32K | Low | Default for many DGX Spark recipes |
| 64K | Moderate | Safe for most single-model configs |
| 128K | High | Tested on GB10; needs utilization ≤ 0.85 if solo |
| 256K | Very High | Only with quantized model or very low utilization |

## Training While Serving

With executor at 0.50 and analyst at 0.08, ~54 GB remains free.
Training the E2B analyst with Unsloth LoRA peaks at ~12–16 GB.

You **can** train with both models running, but it is safer to stop
the analyst container during training (you are replacing its weights
anyway).

## Reference Sources

- DGX Spark GB10 image docs: context length presets and GPU memory tuning
- vLLM 0.19 release notes: Gemma 4 + Blackwell NVFP4 + SM121 fixes
- Community GB10 repo: "Stock vLLM does not work on DGX Spark GB10"
- NVIDIA Gemma 4 blog: DGX Spark 26B A4B NVFP4 benchmark
