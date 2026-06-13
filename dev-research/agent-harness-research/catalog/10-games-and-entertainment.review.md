# Bucket Review

This file records the curated state of `10-games-and-entertainment.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 14
- Retained and rewritten: 11
- Derived lower-scale prompts added: 5
- Current rows in curated bucket: 16
- Removed from this bucket: 3

## Notes

This bucket mostly needed rewriting from fragments into complete asks. One ambiguous term-lookup row was removed.

This pass keeps the surviving prompts but updates output wording toward current digital-first use and adds smaller prompts for scoreboard panels, standings tables, puzzle palettes, challenge cards, and session logs.

## Retention Criteria

- plausible user-voiced requests
- bounded module or operator workflow
- useful as a standalone MSS-style training prompt
- preserves the play or tracking job while sounding current
- supports recursive fanout toward smaller modules where appropriate

## Removal Criteria

- raw parameter stubs or API fragments
- heavily dated or implausible user framing
- developer-library requests better suited to implementation datasets
- duplicate or near-duplicate ideas with weaker wording
- prompts that clearly belonged in another domain
