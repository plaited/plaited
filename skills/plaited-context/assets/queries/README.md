# Query Templates

`plaited-context` keeps SQL templates in this directory as static assets.

Slice 0 ships a schema-first substrate. Runtime scripts currently issue
parameterized SQL directly in TypeScript while this query catalog is kept for
future expansion (for example: saved search presets, review exports, and
finding triage views).

Planned template groups:

- file/symbol discovery by path, symbol name, and import edge
- stale-doc candidate discovery from docs-to-source drift
- review exports grouped by finding status and module boundary
- context assembly ranking for review/implement/doc modes
