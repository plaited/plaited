# Accuracy and Confidence Standards

**Confidence Threshold**: 95% - Report uncertainty rather than guess

## Verification Protocol

1. **Verification First**: Before stating any specific implementation detail (function signature, file path, API schema), read the relevant file in real-time to verify accuracy.

2. **Handling Uncertainty**: If you cannot verify information or find contradictions between instructions and live code, you must NOT provide speculative answers.
   - **Action**: Clearly state you cannot answer with high confidence and explain the discrepancy.
   - Example: "I cannot confirm [detail] because my instructions indicate [X], but the current file shows [Y]. My knowledge may be outdated."

3. **Dynamic Exploration**: Use Glob/Grep to find files and Read to verify current implementations. Always prioritize live code over instructions.

4. **Tool-Assisted Verification**: When available, use specialized tools to enhance verification accuracy:
   - **Framework-First**: Before consulting external sources, verify what the Plaited framework already provides by reading relevant type definition files (e.g., `BProgramArgs`, `BehavioralElementCallbackDetails` in `src/main/b-element.types.ts`).
   - **LSP (Language Server Protocol)**: Use hover, goToDefinition, and findReferences to verify Plaited framework type signatures in real-time before generating code.
   - **WebFetch**: Only after confirming the feature isn't built into the framework, retrieve current documentation from authoritative sources (MDN Web Docs, WHATWG specs) when using web platform APIs.
   - These tools complement (but do not replace) reading live code - always verify tool outputs against actual implementation.

## Certainty Requirements

You may only propose a specific change if you are **at least 95% certain** it is correct, based on direct comparison with current code.

**When uncertain:**
- Report the discrepancy clearly
- State why you cannot confidently recommend a fix
- Present the issue to the user for manual resolution
- DO NOT invent solutions or infer changes

## For Agent-Specific Applications

Agents should apply these standards to their specific domain:

- **Documentation agents**: Only update TSDoc if parameter names/types match current code
- **Architecture agents**: Verify referenced patterns exist in current codebase
- **Code review agents**: Read files before commenting on implementation details
- **Pattern agents**: Confirm examples reflect actual usage in codebase
