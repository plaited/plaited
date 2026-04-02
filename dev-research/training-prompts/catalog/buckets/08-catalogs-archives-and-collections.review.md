# Bucket Review

This file records the curated state of `08-catalogs-archives-and-collections.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 95
- Retained and rewritten: 22
- Derived lower-scale prompts added: 14
- Current rows in curated bucket: 36
- Removed from this bucket: 73

## Notes

This bucket was mostly salvageable but had many weak utilities mixed into it. The curated set keeps the strongest inventory, archive, and collection-management prompts.

For this pass, the retained prompts were also modernized so they read like current user asks rather than late-1990s media workflows. Legacy wording around CDs, tapes, VHS, and removable media was updated toward present-day equivalents such as ripped libraries, Blu-rays, external drives, NAS snapshots, and Plex or Jellyfin collections where that preserved the same underlying task.

This bucket now also includes a second layer of derived prompts for smaller reusable modules that would naturally fall out of the larger archive apps, such as item editors, filter panels, import mappers, storage-location registers, and timeline views. The goal is to give `pi:review` both larger archive shells and plausible lower-scale module prompts in the same domain.

When a legacy software-library prompt still had a valid modern core, it was rewritten toward current modnet operator language instead of being dropped. In this bucket that means preferring module, node, compatibility, and network-link framing over obsolete media-distribution packaging.

## Retention Criteria

- plausible user-voiced requests
- bounded module or operator workflow
- useful as a standalone MSS-style training prompt
- preserves the original intent while sounding current
- supports recursive fanout toward smaller modules where appropriate

## Removal Criteria

- raw parameter stubs or API fragments
- heavily dated or implausible user framing
- developer-library requests better suited to implementation datasets
- duplicate or near-duplicate ideas with weaker wording
- prompts that clearly belonged in another domain
