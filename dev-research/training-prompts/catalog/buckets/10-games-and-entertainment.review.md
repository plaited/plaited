# Bucket Review

This file records the curated state of `10-games-and-entertainment.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 14
- Retained and rewritten: 11
- Removed from this bucket: 3

## Notes

This bucket mostly needed rewriting from fragments into complete asks. One ambiguous term-lookup row was removed.

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
