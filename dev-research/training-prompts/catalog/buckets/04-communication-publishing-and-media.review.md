# Bucket Review

This file records the curated state of `04-communication-publishing-and-media.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 100
- Retained and rewritten: 23
- Removed from this bucket: 77

## Notes

This bucket benefited from heavy pruning. The retained set focuses on messaging, publishing, mail, media distribution, and communication tools a real operator might request.

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
