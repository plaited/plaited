# Bucket Review

This file records the curated state of `05-education-reference-and-practice.jsonl`.

It intentionally diverges from the generated `index.json` snapshot for the full bucket set.

## Outcome

- Original rows: 228
- Retained and rewritten: 46
- Derived lower-scale prompts added: 5
- Current rows in curated bucket: 51
- Removed from this bucket: 182

## Notes

This bucket contained many viable prompts but also a large amount of duplication, thin fragments, and dated scaffolding. The curated set keeps the strongest study, drill, quiz, and reference prompts across math, language, science, and humanities.

The modernization pass updates classroom and printable-only framing toward mixed digital and printable use while keeping the instructional job intact. It also adds smaller recursive prompts for flashcards, quiz feedback, study progress, worksheet questions, and reference detail cards.

## Retention Criteria

- plausible user-voiced requests
- bounded module or operator workflow
- useful as a standalone MSS-style training prompt
- preserves the instructional job while sounding current
- supports recursive fanout toward smaller modules where appropriate

## Removal Criteria

- raw parameter stubs or API fragments
- heavily dated or implausible user framing
- developer-library requests better suited to implementation datasets
- duplicate or near-duplicate ideas with weaker wording
- prompts that clearly belonged in another domain
