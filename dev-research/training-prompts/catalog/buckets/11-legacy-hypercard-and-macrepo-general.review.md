# Bucket Review

This file records the curated state of `11-legacy-hypercard-and-macrepo-general.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 448
- Retained and rewritten: 41
- Removed from this bucket: 407

## Notes

This bucket was the biggest source of noise. The curated set aggressively collapses it to a smaller long-tail of prompts that still read like plausible bounded user jobs.

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
