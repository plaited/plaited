# Embarrassingly Simple Self-Distillation (arXiv:2604.01193)

> Status: external paper note captured for wiki context.
> Source capture date: April 25, 2026.

## Citation

- Title: *Embarrassingly Simple Self-Distillation Improves Code Generation*
- Authors: Ruixiang Zhang, Richard He Bai, Huangjie Zheng, Navdeep Jaitly,
  Ronan Collobert, Yizhe Zhang
- Submitted: April 1, 2026 (`v1`)
- arXiv: [2604.01193](https://arxiv.org/abs/2604.01193)
- HTML: [2604.01193v1](https://arxiv.org/html/2604.01193v1)
- PDF: [2604.01193](https://arxiv.org/pdf/2604.01193)
- DOI: [10.48550/arXiv.2604.01193](https://doi.org/10.48550/arXiv.2604.01193)

## Summary

The paper argues that code-generation models can improve through a very simple
self-distillation loop that does not require:

- a verifier or test execution loop
- a teacher model
- reinforcement learning
- external labeled solutions

Their method samples raw solutions from a base model under chosen decoding
settings (temperature and truncation), then runs standard supervised fine-tuning
on those unverified samples.

## Reported Results

From the paper abstract and front matter:

- Qwen3-30B-Instruct improves from `42.4%` to `55.3%` pass@1 on LiveCodeBench
  v6.
- Gains are concentrated on harder coding problems.
- Improvements generalize across Qwen and Llama families, across 4B, 8B, and
  30B scales, including instruct and thinking variants.
- The proposed mechanism is a precision-exploration conflict during decoding;
  SSD is claimed to reduce distractor tails where precision matters while
  preserving diversity where exploration matters.

## Relevance To Plaited

This is relevant to [Training And Improvement](training-and-improvement.md)
because it is a concrete post-training path that:

- uses model-generated traces as the training substrate
- relies on standard SFT infrastructure instead of RL/verifier-heavy loops
- emphasizes distribution shaping and decoding-aware data generation

This does not replace Plaited's module-first search strategy, but it is a
useful adjacent reference for later neural adaptation phases once symbolic
module behavior is stable.

## Provenance

Captured via You.com `contents` endpoint for:

- `https://arxiv.org/html/2604.01193v1` (full body extraction)
- `https://arxiv.org/abs/2604.01193` (clean citation metadata extraction)
