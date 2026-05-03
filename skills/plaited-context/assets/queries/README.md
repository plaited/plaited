# Query Templates

`plaited-context` keeps SQL templates in this directory as static assets.

Runtime scripts currently issue parameterized SQL directly in TypeScript while
this query catalog stays available for future expansion.

Current persistence focus:

- finding lifecycle storage (`candidate`, `validated`, `retired`)
- finding evidence rows
- cached top-level `plaited` evidence payloads
- review export assembly from persisted findings and cache rows
