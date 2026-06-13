# Bucket Review

This file records the curated state of `06-creative-tools-and-design.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 110
- Retained and rewritten: 25
- Derived lower-scale prompts added: 5
- Current rows in curated bucket: 30
- Removed from this bucket: 85

## Notes

This bucket had a lot of drift into utilities and developer components. The curated version keeps prompts centered on creative production, media authoring, visual design, and presentation tools.

Legacy cassette, VHS, and QuickTime-era framing was rewritten toward current creative workflows such as archival labeling, motion assets, and embedded media previews without dropping the underlying design jobs. This pass also adds smaller prompts for animation controls, asset previews, hotspot editing, story beats, and font sample tiles.

## Retention Criteria

- plausible user-voiced requests
- bounded module or operator workflow
- useful as a standalone MSS-style training prompt
- preserves the creative job while sounding current
- supports recursive fanout toward smaller modules where appropriate

## Removal Criteria

- raw parameter stubs or API fragments
- heavily dated or implausible user framing
- developer-library requests better suited to implementation datasets
- duplicate or near-duplicate ideas with weaker wording
- prompts that clearly belonged in another domain
