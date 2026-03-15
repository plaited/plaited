---
name: varlock
description: AI-safe environment configuration with Varlock. Use when setting up node environment requirements, configuring secret providers for enterprise deployments, generating seeds that declare .env.schema, or ensuring agents never leak secrets into context/history/training data.
license: ISC
compatibility: Requires bun
---

# Varlock

## Purpose

This skill teaches agents how to use [Varlock](https://varlock.dev/) for AI-safe environment configuration in the Plaited node topology. Varlock replaces `.env.example` files with typed `.env.schema` — the single source of truth for environment requirements with sensitivity markers, type annotations, and provider references.

**Use when:**
- Setting up a new node that needs environment configuration
- Enterprise provisioning where secrets come from external providers
- Generating seeds that declare environment requirements
- Ensuring the agent never leaks secrets into context/history/training data

**Not for:** Application-level config that doesn't involve secrets (use constants or JSON config files instead).

## Core Concept

Agents read `.env.schema` for context — never `.env` files. The schema tells the agent what environment variables a node needs, their types, and whether they're sensitive. The agent generates code that reads `process.env.VAR_NAME` but never sees actual values.

```ini
# Agent sees this (safe):
DATABASE_URL=
  @sensitive
  @required
  @type url
  @description PostgreSQL connection string

# Agent NEVER sees this (.env file blocked by MAC rule):
# DATABASE_URL=postgres://user:password@host:5432/db
```

## CLI Integration

```bash
# Initialize Varlock in a node workspace
bunx varlock init

# Validate environment against schema
bunx varlock validate

# Run node with validated environment
bunx varlock run -- bun run src/main.ts
```

Seeds should include `bunx varlock init` when the deployment requires secret management.

## Reference Documents

| Document | Purpose |
|----------|---------|
| [schema-patterns.md](references/schema-patterns.md) | `.env.schema` patterns for each node role |
| [enterprise-secrets.md](references/enterprise-secrets.md) | Secret provider setup for enterprise deployments |
| [constitution-rules.md](references/constitution-rules.md) | MAC bThread patterns for secret protection |

## Decision: When to Use Varlock

| Scenario | Use Varlock? | Reason |
|----------|-------------|--------|
| Node needs API keys or credentials | Yes | Secrets must not leak into agent context |
| Node connects to external services | Yes | Connection strings are sensitive |
| Local-only dev node with no secrets | No | Use `process.env` directly |
| Node needs only structural config (ports, roles) | Partial | Use schema for documentation, no `@sensitive` needed |

## Workflow: Setting Up a New Node

1. **Initialize:** `bunx varlock init` creates `.env.schema`
2. **Define requirements:** Add variables with metadata (see [schema-patterns.md](references/schema-patterns.md))
3. **Configure providers:** For enterprise, add `@source` directives (see [enterprise-secrets.md](references/enterprise-secrets.md))
4. **Add MAC rule:** Include the secret-protection bThread in the node's constitution (see [constitution-rules.md](references/constitution-rules.md))
5. **Generate code:** Agent reads `.env.schema`, generates code using `process.env.VAR_NAME`
6. **Run:** `bunx varlock run -- bun run src/main.ts` resolves secrets at startup

## Related Skills

- **search-varlock-docs** — Search the Varlock documentation via MCP
- **node-auth** — Authentication strategies for Plaited nodes
- **constitution** — Governance factory patterns (MAC/DAC rules)
