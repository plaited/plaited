# Wiki Log

## 2026-05-07

- Retired the boundary-contract-review and node-auth skill surfaces.
- Removed wiki references to those skill directories while keeping the canonical doctrine pages.

## 2026-05-03

- Retired the Agent Loop page while orchestration doctrine is being rebuilt around current
  behavioral specs, worker runtime, and `src/engines/vllm.ts` command surfaces.
- Removed Agent Loop links from wiki navigation instead of preserving uncertain doctrine.

## 2026-05-02

- Added Dynamic Skills Agent Model doctrine page covering node-vs-skill boundary, envelope shape,
  capability registry ownership in `src/skills`, and orchestrator target direction.
- Linked Dynamic Skills Agent Model from index, architecture, dual-lane model, and sources pages.
- Documented MCP-backed skill generation as a proposal/review/generation target flow without
  claiming end-to-end runtime implementation.

## 2026-04-26

- Added canonical doctrine pages for dual-lane node model, boundary-contract
  graph, and node-to-node auth.
- Rewrote core architecture wiki pages with explicit implemented-now vs
  target-direction splits.
- Marked Modnet and Structural IA content as lineage/non-normative guidance.
- Added boundary-contract and node-auth skill surfaces.
- Updated MCP app skills with mandatory lane classification, contract-first
  exposure, entitlement checks, provenance/watermark guidance, and extension
  fallback requirements.

## 2026-04-25

- Added an external paper note for arXiv:2604.01193 ("Embarrassingly Simple
  Self-Distillation Improves Code Generation").
- Linked the new paper note from the wiki index and sources provenance page.
- Recorded You.com `contents` capture method for reproducible provenance.
- Added an external research note for Chroma Context-1 and linked it in wiki
  index/sources.
- Used You.com `research` as the synthesis source for that note after full-page
  `contents` payload truncation on the target URL.

## 2026-04-22

- Moved durable top-level architecture docs into focused wiki pages.
- Added the local inference bridge ADR documenting the Unix domain socket
  framed `ActorEnvelope` stream decision.
- Retired the non-normative hypothetical architecture note.
- Created the first Plaited architecture wiki scaffold.
- Added target doctrine for actor-owned facts/resources, services/actions,
  policy/grants, provenance, and local projections.
- Translated Modnet `scale` into transitional compatibility language rather
  than target ontology.
- Added Structural IA lineage notes focused on functional analysis, human
  movement through digital space, mechanics, boundaries, and mental maps.
