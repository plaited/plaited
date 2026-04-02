# Bucket 07 Review

This file is a first-pass curation of the original `07-developer-automation-and-system-utilities.jsonl` bucket.

It intentionally diverges from the generated `index.json` snapshot for the bucket set.
This review file describes the curated state for bucket `07`.

## Outcome

- Original rows: 115
- Retained and rewritten: 26
- Derived lower-scale prompts added: 5
- Current rows in curated bucket: 31
- Removed from this bucket: 89

## Retention Criteria

Kept prompts only when they could be reframed as:

- a plausible request from a non-technical or moderately technical end user
- a bounded local utility or operator-facing tool
- a module with clear standalone value inside MSS-style prompt generation

## Removal Criteria

Removed prompts when they were primarily:

- raw function signatures or parameter stubs
- developer library/component implementation asks rather than end-user module asks
- outdated host-extension or platform-internals wrappers
- prompt-generation meta rows rather than real user jobs
- likely better suited for another bucket such as finance, visualization, or media

## Notes

This pass keeps the existing curation direction but modernizes the remaining utility wording where needed and adds smaller prompts for reusable utility surfaces such as shortcut cards, command lists, search filters, startup bundles, and ACP connection profiles.

A few removed rows still look salvageable for the broader corpus, but not for this utility bucket. Examples: `hypercard_mortgage-payment-calculator-demo`, `hypercard_chartoid_2`, `hypercard_sound-machine`, and `hypercard_hyperkeys-music--sound`.
