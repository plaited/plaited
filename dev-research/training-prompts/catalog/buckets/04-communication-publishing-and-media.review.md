# Bucket Review

This file records the curated state of `04-communication-publishing-and-media.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 100
- Retained and rewritten: 23
- Derived lower-scale prompts added: 5
- Current rows in curated bucket: 28
- Removed from this bucket: 77

## Notes

This bucket benefited from heavy pruning. The retained set focuses on messaging, publishing, mail, media distribution, and communication tools a real operator might request.

This pass modernizes older mail and messaging wording toward present-day inbox, notification, and media-publishing workflows while keeping the same underlying communication jobs. It also adds smaller prompts for inbox shells, cross-post composers, hold summaries, thread views, and subtitle editing.

## Retention Criteria

- plausible user-voiced requests
- bounded module or operator workflow
- useful as a standalone MSS-style training prompt
- preserves the underlying communication workflow while sounding current
- supports recursive fanout toward smaller modules where appropriate

## Removal Criteria

- raw parameter stubs or API fragments
- heavily dated or implausible user framing
- developer-library requests better suited to implementation datasets
- duplicate or near-duplicate ideas with weaker wording
- prompts that clearly belonged in another domain
