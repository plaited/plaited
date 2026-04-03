# Bucket Review

This file records the curated state of `03-work-business-and-service-operations.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 110
- Retained and rewritten: 30
- Derived lower-scale prompts added: 5
- Current rows in curated bucket: 35
- Removed from this bucket: 80

## Notes

This bucket mixed credible business workflows with many utilities and unrelated prompts. The curated set keeps clear work, scheduling, internal-tool, and small-business operations prompts.

The modernization pass removes stale framing such as era-specific organizer language and updates software-tracking rows toward current app, module, subscription, and node-service workflows. It also adds smaller prompts for review cards, booking slots, invoice lines, customer records, and capacity panels.

## Retention Criteria

- plausible user-voiced requests
- bounded module or operator workflow
- useful as a standalone MSS-style training prompt
- preserves the underlying operator workflow while sounding current
- supports recursive fanout toward smaller modules where appropriate

## Removal Criteria

- raw parameter stubs or API fragments
- heavily dated or implausible user framing
- developer-library requests better suited to implementation datasets
- duplicate or near-duplicate ideas with weaker wording
- prompts that clearly belonged in another domain
