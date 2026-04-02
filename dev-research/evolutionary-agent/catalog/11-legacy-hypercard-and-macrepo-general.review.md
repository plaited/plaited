# Bucket Review

This file records the curated state of `11-legacy-hypercard-and-macrepo-general.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 448
- Retained and rewritten: 41
- Derived lower-scale prompts added: 5
- Current rows in curated bucket: 46
- Removed from this bucket: 407

## Notes

This bucket was the biggest source of noise. The curated set aggressively collapses it to a smaller long-tail of prompts that still read like plausible bounded user jobs.

The modernization pass updates the most dated surviving surfaces toward current media, backup, web, and digital-reading workflows without changing the core task. It also adds smaller prompts for route search, bookmark entries, conversion rows, drive archive entries, and decision criteria tables.

## Retention Criteria

- plausible user-voiced requests
- bounded module or operator workflow
- useful as a standalone MSS-style training prompt
- preserves the underlying job while sounding current
- supports recursive fanout toward smaller modules where appropriate

## Removal Criteria

- raw parameter stubs or API fragments
- heavily dated or implausible user framing
- developer-library requests better suited to implementation datasets
- duplicate or near-duplicate ideas with weaker wording
- prompts that clearly belonged in another domain
