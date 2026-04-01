# Bucket Review

This file records the curated state of `08-catalogs-archives-and-collections.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 95
- Retained and rewritten: 22
- Removed from this bucket: 73

## Notes

This bucket was mostly salvageable but had many weak utilities mixed into it. The curated set keeps the strongest inventory, archive, and collection-management prompts.

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
