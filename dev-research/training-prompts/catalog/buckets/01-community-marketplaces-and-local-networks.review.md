# Bucket Review

This file records the curated state of `01-community-marketplaces-and-local-networks.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 17
- Retained and rewritten: 17
- Derived lower-scale prompts added: 5
- Current rows in curated bucket: 22
- Removed from this bucket: 0

## Notes

This bucket already contained a coherent operator-facing story. The pass keeps the full set and mainly rewrites for cleaner user voice and clearer MSS-style boundedness.

This modernization pass also adds smaller recursive prompts for item cards, vendor summaries, connection toggles, category switching, and boundary controls so `pi:review` can work downward toward lower-scale modules inside the same market-network domain.

## Retention Criteria

- plausible user-voiced requests
- bounded module or operator workflow
- useful as a standalone MSS-style training prompt
- supports recursive fanout toward smaller modules where appropriate

## Removal Criteria

- raw parameter stubs or API fragments
- heavily dated or implausible user framing
- developer-library requests better suited to implementation datasets
- duplicate or near-duplicate ideas with weaker wording
- prompts that clearly belonged in another domain
