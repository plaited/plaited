---
name: validate-skill
description: Validate skill directories against AgentSkills structural spec
license: ISC
compatibility: Requires bun
allowed-tools: Bash
---

# Validate Skill

Validates skill directories against the [AgentSkills specification](https://agentskills.io/specification).
This skill is for structural/spec compliance only. It does not judge trigger
quality, output quality, or overall behavioral performance.

**Use when:**
- Creating a new skill — run before committing to catch frontmatter errors
- Reviewing PRs that add or modify skills
- Bulk-validating a skills directory

**Do not use for:**
- deciding whether a description triggers reliably
- grading whether a skill produced a strong answer
- behavioral trial runs during autoresearch

## Interface

```
plaited validate-skill '<json>' [--schema input|output] [-h]
echo '<json>' | plaited validate-skill
```

Input and output are always JSON. No human-readable mode.

### Input

```json
{"paths": ["skills/my-skill", "skills"]}
```

`path` and `paths` are both supported. If neither is provided, the command defaults to `skills/` in the current working directory. Pass a skill directory directly or a parent directory containing multiple skill directories.

### Output

JSON array, one entry per skill found:

```json
[
  {
    "valid": true,
    "path": "/abs/path/to/skill",
    "errors": [],
    "warnings": [],
    "properties": {
      "name": "my-skill",
      "description": "What this skill does",
      "body": "# Markdown body after frontmatter...",
      "license": "ISC",
      "compatibility": "Requires bun",
      "allowed-tools": ["Bash", "Read"],
      "metadata": { "author": "eirby" }
    }
  }
]
```

`properties` is only present when `valid: true`. `allowed-tools` is always an array (parsed from space-delimited string in frontmatter).

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | All skills valid |
| `1` | One or more skills invalid |
| `2` | Bad input or tool error |

### Schema introspection

```bash
plaited validate-skill --schema input   # JSON Schema for input
plaited validate-skill --schema output  # JSON Schema for output
```

Use `--schema output` to discover the full shape of the result without reading docs.

## Usage examples

```bash
# Validate a specific skill
plaited validate-skill '{"path": "skills/my-skill"}'

# Validate all skills under a directory
plaited validate-skill '{"path": "skills"}'

# Validate multiple directories
plaited validate-skill '{"paths": ["skills", "vendor-skills"]}'

# Default: validates skills/ in cwd
plaited validate-skill '{}'

# Stdin pipe
echo '{"paths": ["skills"]}' | plaited validate-skill

# Discover output schema
plaited validate-skill --schema output
```

## Structural validation rules

### Required frontmatter fields

- `name` — lowercase, alphanumeric + hyphens only, max 64 chars, must match directory name
- `description` — non-empty string, max 1024 chars

### Optional frontmatter fields

- `license` — license identifier (e.g. `ISC`, `MIT`)
- `compatibility` — runtime requirements, max 500 chars
- `allowed-tools` — space-delimited tool names (e.g. `Bash Read Write`) → parsed as `string[]`
- `metadata` — YAML object with string values only

Unknown frontmatter fields produce warnings (not errors).

## Behavioral evaluation split

Behavioral evaluation is a separate concern from validation.

- Validation checks structure, frontmatter, and directory conventions.
- Evaluation should stay local to the skill when practical.
- The initial convention is an optional `evals/` directory inside the skill:
  - `evals/trigger-prompts.jsonl` for activation-quality prompts
  - `evals/output-cases.jsonl` for output-quality cases
  - `evals/RUBRIC.md` for reviewer guidance

Those files are discoverable by framework tooling, but they are not required
for AgentSkills compatibility and are not enforced by `validate-skill`.

### Naming rules

- Lowercase only
- Alphanumeric and hyphens only
- No leading/trailing hyphens
- No consecutive hyphens (`--`)
- Directory name must match `name` field exactly
