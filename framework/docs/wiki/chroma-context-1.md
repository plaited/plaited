# Chroma Context-1 (trychroma.com/research/context-1)

> Status: external research note captured for wiki context.
> Source capture date: April 25, 2026.

## Source

- Page: [Chroma Context-1: Training a Self-Editing Search Agent](https://www.trychroma.com/research/context-1)
- Organization: Chroma

## Claimed Contributions

From the captured source summary:

- Context-1 is positioned as a retrieval-focused subagent rather than a direct
  answer model.
- Training uses a staged curriculum that shifts from recall-first retrieval to
  precision-first selective retention.
- The agent performs self-editing context management by discarding irrelevant
  passages during multi-turn search to preserve context capacity and reduce
  context rot.
- The work describes a synthetic task-generation pipeline and reports public
  releases for both model weights and data-generation code.

## Reported Setup

- The model operates in an observe-reason-act loop with structured tool calls
  for search/retrieval.
- Tool results are appended to trajectory context for subsequent actions.
- Context editing is part of the retrieval loop rather than a separate
  post-processing phase.

## Reported Outcomes

- The page reports comparisons against multiple baseline models across both
  newly generated and public retrieval benchmarks.
- It claims frontier-comparable retrieval performance for Context-1, and
  substantial gains over its cited base model (`gpt-oss-20b`) across evaluated
  domains.

## Relevance To Plaited

This is adjacent to [Training And Improvement](training-and-improvement.md)
because it reinforces:

- role-specialized subagents (retrieval separated from answer generation)
- iterative search with explicit context management policies
- synthetic-task infrastructure as a practical training data source

## Provenance

Captured through You.com APIs on April 25, 2026:

- `contents` metadata for URL identity/title verification
- `research` for a parseable, source-cited synthesis when full-page `contents`
  payloads were truncated
