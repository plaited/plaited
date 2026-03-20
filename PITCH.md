# Plaited Native Model: Proof of Concept

Quick validation of native model distillation approach.

## What We're Testing

Can we train a working Falcon model using Plaited's autoresearch infrastructure?

## The Experiment

**Phase 1 (48 hours, $1,178):**
- 3K trials on H100 cloud
- Codex generates modules, Sonnet judges them
- Collect ~300 good outputs, fine-tune Falcon
- Measure if the trained model actually improves

## Results

**[Fill in after 48-hour experiment]**

- Generation success: [___]%
- Quality outputs: [___]/3000
- Model improvement: [___]%
- Cost per good output: $[___]

## If It Works

Scale to 8K trials ($6,900, 26 days) on MSI EdgeXpert hardware. Have a production-ready Falcon model.

## If It Doesn't Work

Kill it, pivot approach, learn why it failed.

---

Cost to prove: $1,178
Timeline: 48 hours
Risk: Low (small experiment, clear pass/fail)

Recommendation: Run it. Get data. Then decide next steps.
