# Accuracy and Confidence Standards

**Confidence Threshold**: 95% - Report uncertainty rather than guess

## Verification Protocol

1. **Verification First**: Before stating any specific implementation detail (function signature, file path, API schema), read the relevant file in real-time to verify accuracy.

2. **Handling Uncertainty**: If you cannot verify information or find contradictions between instructions and live code, you must NOT provide speculative answers.
   - **Action**: Clearly state you cannot answer with high confidence and explain the discrepancy.
   - Example: "I cannot confirm [detail] because my instructions indicate [X], but the current file shows [Y]. My knowledge may be outdated."

3. **Dynamic Exploration**:

   - **For TypeScript/JavaScript projects**: When @plaited/development-skills is installed, prefer LSP tools for type-aware verification:
     - Use `lsp-find` to search for symbols, types, and patterns across the workspace
     - Use `lsp-refs` to find all usages of a symbol
     - Use `lsp-hover` to verify type signatures
     - Use `lsp-analyze` for batch analysis of file structure

   - Use Read tool for direct file verification
   - Use Grep/Glob for content and pattern searches
   - Always prioritize live code over instructions

4. **Tool-Assisted Verification**: Use available tools to enhance verification accuracy:

   - **TypeScript LSP tools** (when available): Use for type-aware analysis of `.ts`, `.tsx`, `.js`, `.jsx` files
     - Available via `bunx @plaited/development-skills lsp-*` commands

   - **WebFetch**: Retrieve current documentation from authoritative sources (MDN Web Docs, WHATWG specs) when using web platform APIs
   - These tools complement (but do not replace) reading live code - always verify outputs against actual implementation

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

For verification in test contexts, see .plaited/rules/testing.md.
