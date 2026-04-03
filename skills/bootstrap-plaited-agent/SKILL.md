---
name: bootstrap-plaited-agent
description: Bootstrap and configure a local-first Plaited agent deployment through the official plaited CLI.
license: ISC
compatibility: Requires bun and the published plaited CLI
allowed-tools: Bash Read Write
---

# Bootstrap Plaited Agent

Use this skill when an agent needs to initialize or inspect a Plaited agent
deployment scaffold through the official CLI.

## Purpose

This skill assumes the stable operator surface is:

- `plaited bootstrap`

Use the CLI instead of inventing ad hoc directory layouts or config files.

## Workflow

1. Inspect the command contract if needed:

```bash
plaited bootstrap --schema input
```

2. Dry-run a bootstrap request first when the target directory or profile is
unclear:

```bash
plaited bootstrap '{"targetDir":".","name":"plaited-agent","profile":"local-first"}' --dry-run
```

3. Run the real bootstrap command:

```bash
plaited bootstrap '{"targetDir":".","name":"plaited-agent","profile":"local-first","primaryBaseUrl":"http://127.0.0.1:8000/v1","primaryModel":"falcon-h1r-7b","memoryProvider":"agentfs","sandboxProvider":"boxer","syncProvider":"none"}'
```

4. Review the generated `.plaited/` files before enabling autonomous behavior.

## What The Command Produces

The bootstrap scaffold should create:

- deployment metadata under `.plaited/config/`
- durable memory roots under `.plaited/memory/`
- runtime notes under `.plaited/runtime/`

Treat those files as the source of truth for deployment setup.

## Guidance

- Prefer `local-first` unless the task clearly calls for another profile.
- Treat `primaryBaseUrl` and `primaryModel` as the most important initial
  configuration.
- Keep sandbox and sync choices explicit and reviewable.
- Re-run with `overwrite: true` only when you intend to replace the generated
  scaffold.

## Non-Goals

This skill does not replace:

- model serving setup
- sandbox installation
- sync credential provisioning

It bootstraps the Plaited-side scaffold that those pieces plug into.
