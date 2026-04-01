# Bucket Review

This file records the curated state of `03-work-business-and-service-operations.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 110
- Retained and rewritten: 30
- Removed from this bucket: 80

## Notes

This bucket mixed credible business workflows with many utilities and unrelated prompts. The curated set keeps clear work, scheduling, internal-tool, and small-business operations prompts.

## Retention Criteria

- plausible user-voiced requests
- bounded module or operator workflow
- useful as a standalone MSS-style training prompt

## Removal Criteria

- raw parameter stubs or API fragments
- heavily dated or implausible user framing
- developer-library requests better suited to implementation datasets
- duplicate or near-duplicate ideas with weaker wording
- prompts that clearly belonged in another domain
