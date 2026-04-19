# AGENTS.md

## Module File Rule

This directory intentionally overrides the repo-wide preference for split
feature files.

In this directory, "module" means a core module program: a single TypeScript
file that contributes executable behavior to the node. It does not mean a full
future user module package with assets, databases, styles, templates, eval
fixtures, or other resources.

Core module programs in `src/modules` should be authored as single TypeScript
files directly under this directory:

```text
src/modules/<module-name>.ts
```

Do not create a new folder for a module. Keep the module's schemas, types,
constants, behavioral threads, and exported module program in the same file
unless the user explicitly asks for a split.

Rationale:

- modules here are expected to be agent-generated or agent-rewritten
- smaller editable surfaces make autoresearch loops easier to target
- single-file modules make generated diffs easier for human review
- module boundaries should be visible in one file instead of spread across
  helper files

Existing folder-based modules are legacy. Do not expand them with additional
files unless a task explicitly requires it. When a task substantially rewrites a
legacy folder-based module, prefer migrating it to a single flat module file if
that migration is in scope.

If a future module needs non-code assets or persistent resources, do not expand
`src/modules` by default. Design or use a separate user module package layout
instead.
