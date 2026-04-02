# Bucket Review

This file records the curated state of `02-home-family-and-personal-life.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 57
- Retained and rewritten: 21
- Derived lower-scale prompts added: 5
- Current rows in curated bucket: 26
- Removed from this bucket: 36

## Notes

This bucket had many plausible home-use ideas mixed with weak or dated fragments. The curated set keeps the strongest household, family, recipe, and home-maintenance prompts and removes noisy leftovers.

Legacy recipe and household prompts were modernized toward current screen-first home workflows while preserving their original job. This pass also adds smaller prompts for recipe cards, meal plans, photo detail views, chore cards, and vehicle service entries.

## Retention Criteria

- plausible user-voiced requests
- bounded module or operator workflow
- useful as a standalone MSS-style training prompt
- preserves the original household job while sounding current
- supports recursive fanout toward smaller modules where appropriate

## Removal Criteria

- raw parameter stubs or API fragments
- heavily dated or implausible user framing
- developer-library requests better suited to implementation datasets
- duplicate or near-duplicate ideas with weaker wording
- prompts that clearly belonged in another domain
