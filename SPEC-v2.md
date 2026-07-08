# SPEC v2: Plaited UI Generation Pipeline — HTMLRewriter Validation → ICL → Rejection-Sampling Fine-Tuning

## 0. What changed from v1

1. Scripts are validated, not ignored. A `p-trusted` boolean gates which `<script>` tags may run; Bun's bundler resolves `.ts`/`.js` src at serve/build time.
2. Data binding via `<script type="application/json" p-context>` + `p-target`. The rewriter is an inversion-of-control util: the user supplies a sync/async data callback; the rewriter applies resolved data to nodes/attributes by selector.
3. Training has two dispatch targets: HF tools (local or remote GPU) and Unsloth (local or remote). No hosted training service.
4. Graders are user-overridable and generatable. A `generate-grader` skill lets users author/iterate graders with an agent. No hard-coded UI graders.
5. A dev server is a first-class component — `bun ./page.html --console` for the agent feedback loop, captured into the corpus/eval.

## 1. Script validation & the bundler integration

### 1.1 The `p-trusted` attribute

Confirmed from DSD research: `<script>` inside a DSD `<template shadowrootmode>` executes normally (inline immediately, external via `src`). So scripts are a real, runnable surface and must be validated, not ignored. The contract:

- A `<script>` may run in output only if it carries `p-trusted` (a boolean attribute, serialized bare per `BOOLEAN_ATTRS`) OR has `type="application/json"`.
- `p-trusted` scripts must be external only: `<script p-trusted src="/site-root.js" type="module">`. No inline content. Reject if `p-trusted` present without `src`, or with text content.
- `type="application/json"` scripts are data, never code — exempt from `p-trusted`, never execute, consumed by the data-binding pass.
- All other `<script>` tags (no `p-trusted`, not JSON) are stripped or rejected at validation. No inline JS, ever.

This is the security gate. Add `p-trusted` to `PlaitedAttributesSchema` and to `DetailedScriptHTMLAttributesSchema` in `html.schemas.ts`, and add it to `BOOLEAN_ATTRS` in `html.constants.ts`.

### 1.2 Bun bundler resolves & validates scripts at serve/build

Key insight from the Bun docs: Bun's HTML bundler already does script resolution and validation for `.ts`/`.tsx`/`.js` referenced by `<script src>`:

- `bun ./index.html` (dev server) and `bun build ./index.html` (production) automatically run `<script src>` through Bun's JS/TS/JSX bundler, `<link rel=stylesheet>` through the CSS bundler, and copy/hash images. TypeScript & JSX are supported out of the box — no pre-build step.
- `--compile --target=browser` produces a single standalone `.html` with all JS/CSS/images inlined as `<script type="module">` / `<style>` / `data:` URIs. One file, zero external deps.
- `--console` streams browser `console.log`/`error` back to the terminal — explicitly noted as "useful for AI agents that watch terminal output." This is the agent feedback loop wire.
- Inline `process.env.*` replacement at build time via `bunfig.toml [serve] env` / `--env`.

Implication for the validator: `plaited validate-ui` does not re-implement script resolution. It validates the contract (`p-trusted` present, `src` is a site-root path matching `SITE_ROOT_JAVASCRIPT_PATH_PATTERN`, `type="module"`). The actual "does this `.ts` file exist and bundle" check is delegated to `bun build` as a subprocess grader (Tier 2). This is a clean separation: `plaited` validates policy; Bun validates module resolution and bundling.

## 2. Data binding — `p-context` + `p-target` via inversion-of-control rewriter

### 2.1 The contract

- The last `<script type="application/json" p-context>` in a file is the binding root. Its JSON content is the data context.
- Nodes/attributes that should receive dynamic values carry `p-target="<selector>"` — a CSS selector (HTMLRewriter-native) addressing the node(s) to bind. This mirrors the client-side controller's `p-target` (already in `PlaitedAttributesSchema`).
- The rewriter is a util with inversion of control: the user passes an async/sync callback `dataResolver(context) => data | Promise<data>`. Plaited never hardcodes the data source — it could be a DB query, an API call, a static fixture, a file read. The rewriter just applies resolved values to the right nodes/attributes.

### 2.2 Rewriter pass shape

```ts
type DataBindingInput = {
  html: string
  dataResolver?: (context: unknown) => unknown | Promise<unknown>
}
// 1. HTMLRewriter pass: capture the last script[type="application/json"][p-context] text → JSON.parse → context
// 2. call dataResolver(context) → resolvedData
// 3. second HTMLRewriter pass: for each [p-target] element, resolve value from resolvedData
//    by selector and apply to node text/attribute (user chooses which via the selector convention
//    or an explicit p-bind attribute specifying attribute name)
// 4. strip the p-context script and p-target attributes from output (or keep for hydration)
```

This gives literal + dynamic interpolation on rewrite — HTML files are valid static artifacts; the rewriter hydrates them server-side with the resolver's data. The `p-target` selector approach reuses the existing client-side controller mental model, so users have one binding idiom across SSR and client.

### 2.3 Why inversion of control

Per AGENTS.md §Runtime Wiring Style — don't wrap a single-use callback in a helper. The rewriter takes the resolver directly at the callsite; no `resolveData` indirection layer. The resolver is the user's IoC seam; everything else is deterministic.

## 3. Tier 1 — ICL generation skill (updated)

The `skills/generate-ui/` skill now teaches the agent:

- `DESIGN.md` ingestion → `:root` token block + `var(--token)`.
- Few-shot examples demonstrating: DSD `<template shadowrootmode>` + slots, `<style>` in shadow root, `<script type="application/json" p-context>` for data, `p-target` on dynamic nodes, `<ssr-include src>` for partials, `<script p-trusted src="/app.ts" type="module">` for behavior (Bun bundles the `.ts`), `p-trigger` for events.
- Hard rails: `p-trusted` required for any executable script; JSON sidecar exempt; no inline JS; no inline `on*`.
- Repair loop (≤3) fed by `plaited validate-ui` findings.

The agent emits `.html` + `.ts`/`.css` files; Bun's bundler handles the rest.

## 4. Tier 2 — measurement with user-overridable, generatable graders

### 4.1 No hard-coded UI graders

The repo's `plaited eval` already supports command graders (spawn subprocess, capture stdout/stderr/exit/duration) and compare/calibrate modes. Plaited ships one default grader — `plaited validate-ui` as a command grader — and treats everything else as user-authored.

### 4.2 The `generate-grader` skill

A new `skills/generate-grader/` skill that an agent uses to author and iterate custom graders:

- Inputs: the user's intent (what "good UI" means for their domain — a11y depth, layout fidelity, token adherence, visual match to a reference).
- Outputs: a grader spec consumable by `plaited eval` — either a command grader (wrap any CLI: axe-core, a Playwright screenshot-diff, an LLM-judge script) or an inline judge grader.
- The skill supports an iterate loop: run the grader on a trial set, inspect failures, refine the grader prompt/rules, re-run. This is the agent iterating the measurement, not just the model.

This means users replace plaited's default grader entirely if they want. The default is just a starting point.

### 4.3 Bundler-as-grader

Add a command grader that runs `bun build ./index.html --compile --target=browser` (or `bun build --no-compile` for multi-file) and fails on bundler errors — this catches unresolved `.ts` imports, broken CSS `@import` chains, missing assets. This is the script/CSS/asset validation that `validate-ui` deliberately doesn't duplicate.

## 5. Tier 3 — Rejection-sampling fine-tuning, two dispatch targets

### 5.1 The corpus is still validator-accepted outputs

Unchanged from v1: `plaited ui-corpus` samples N generations per spec, keeps only `validate-ui`-passing (optionally judge-passing) artifacts, emits JSONL, pushes to HF Hub repo. Rejection sampling is what makes this sound (STaR/RFT research).

### 5.2 Two training dispatch targets, both code/notebook paths

Research finding: Unsloth has no canonical REST training endpoint. Remote Unsloth means Studio cloud (UI) or a provider job API (Modal/Thunder Compute); local means `pip install unsloth` + Python. So the skill ships notebook templates, not a service call. Two targets:

**Target A — Hugging Face tools (local or remote GPU):**
- Local: user runs the notebook on their GPU (paid HF Space / Colab / local). `torch.cuda.is_available()` gate blocks CPU.
- Remote: HF AutoTrain or a training Space the user owns. Still GPU.
- Uses `transformers` + `PEFT` + `TRL SFTTrainer`. Adapter pushed to user's HF Hub repo via `HF_TOKEN`.

**Target B — Unsloth (local or remote):**
- Local: `pip install unsloth`, `FastLanguageModel.from_pretrained` + `get_peft_model` (LoRA/QLoRA, 4-bit for tight VRAM). 2× faster, ~70% less VRAM — makes 1–3B models feasible on 8–12 GB GPUs.
- Remote: Unsloth Studio cloud, or Modal/Thunder Compute with the Unsloth image. Driven via the provider's job API, not a single Unsloth HTTP endpoint.
- Exports: LoRA adapter (HF-compatible) or GGUF (for llama.cpp/Ollama local inference).

The skill exposes the hyperparameter surface (`rank`, `alpha`, `lr`, `epochs`, `load_in_4bit`, `target_modules`) and a `target: 'hf' | 'unsloth-local' | 'unsloth-remote'` selector. Both paths produce an adapter the user deploys as their inference backend; re-run `plaited eval compare` to measure the delta.

### 5.3 Model recommendations

Research-validated defaults: 1–3B base (Qwen3-1.8B, Llama-3.2-1B/3B, Gemma-2B) for cost; 7B only if the user has ≥16–24 GB VRAM. QLoRA (4-bit) for memory-constrained GPUs.

## 6. The dev server — agent feedback loop

### 6.1 `bun ./page.html --console` as the loop

The agent runs `bun ./page.html --console` during development. Bun serves the page, bundles `.ts`/`.css` on the fly, and streams browser `console.log`/`error` back to the terminal. The agent watches this output. This works for:

- Iterating the `DESIGN.md` and ICL data (agent edits tokens → reload → observe).
- Iterating the fine-tuned model (swap inference backend → regenerate → observe console errors → feed back into corpus).
- Capturing the feedback loop as data: console errors + validation failures during autonomous improvement runs are logged to the corpus/eval trial record, so the next RFT round trains on the survivors of realistic failure.

### 6.2 Captured feedback → corpus

When the agent runs autonomously to improve the model, the dev-server session's console output and `validate-ui` findings are appended to the trial's snapshot. Failed trials become negatives for optional RIFT-style reward-informed loss; passed trials become the SFT corpus. This closes the loop the research flagged as the value of validator-driven self-training: the failures aren't wasted, they calibrate.

## 7. Honest limits (documented in the skills)

- RFT improves structure adherence + cost; it does not inject knowledge the base model+validator can't approximate. Semantic correctness (visual quality, deep a11y) remains the residual surface — that's why user-overridable graders + calibrate exist.
- Validator gaming. Over-narrow graders → model satisfies the grader, not the true objective. Mitigation: calibrate against human labels; refresh graders periodically.
- `p-trusted` is a policy gate, not a sandbox. A trusted script can still do anything. The security model is "the author vouches for this script"; resolution/bundling is delegated to Bun. Don't claim sandboxing.
- No hosted training. Both targets require the user's GPU. Free-tier users get Tier 1+2 only.
- Premature optimization. Tier 3 only after Tier 2 shows retry/cost above threshold.

## 8. Implementation sequencing (each a vertical slice, repo-green)

1. `p-trusted` + `p-context` in schemas — `html.schemas.ts`, `html.constants.ts`. TDD.
2. `plaited validate-ui` CLI — read-only HTMLRewriter pass: `p-trusted`/JSON contract, attribute validation via `getNodeSchema`, style validation via `cssPropertySchema`, security gates. Retires `use-renderer.ts` + `FLAT-NODE-IR-PROMPT.md`.
3. Data-binding rewriter util — `p-context` capture + `p-target` application via user `dataResolver` IoC callback. Two-pass HTMLRewriter.
4. `generate-ui` skill — `SKILL.md` + few-shot corpus + `DESIGN.md` contract + repair loop.
5. `generate-grader` skill — author/iterate custom graders for `plaited eval`.
6. Bundler grader — `bun build --compile --target=browser` command grader for script/CSS/asset validation.
7. `plaited ui-corpus` CLI — rejection-sampling dataset builder → HF Hub.
8. Training notebook templates — HF and Unsloth (local/remote), target selector, GPU-gated, adapter push.
9. Dev-server feedback capture — `bun ./page.html --console` output → trial snapshots for the autonomous improvement loop.
10. `plaited eval compare` — A/B baseline-vs-fine-tuned.