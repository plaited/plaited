# Bucket Review

This file records the curated state of `09-finance-health-and-life-planning.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 15
- Retained and rewritten: 13
- Derived lower-scale prompts added: 5
- Current rows in curated bucket: 18
- Removed from this bucket: 2

## Notes

This bucket was already small. The only obvious removal was the game prompt; the rest were retained and rewritten as clearer end-user asks.

This pass modernizes a few remaining checkout and reporting surfaces toward current digital workflows while preserving the financial or health task. It also adds smaller prompts for spending rules, payment review dialogs, loan scenario rows, interval editing, and nutrition reference cards.

## Retention Criteria

- plausible user-voiced requests
- bounded module or operator workflow
- useful as a standalone MSS-style training prompt
- preserves the underlying planning or tracking job while sounding current
- supports recursive fanout toward smaller modules where appropriate

## Removal Criteria

- raw parameter stubs or API fragments
- heavily dated or implausible user framing
- developer-library requests better suited to implementation datasets
- duplicate or near-duplicate ideas with weaker wording
- prompts that clearly belonged in another domain
