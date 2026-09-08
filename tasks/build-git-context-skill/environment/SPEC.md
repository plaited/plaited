# SPEC — `git-context` skill

This document is the complete contract for the skill you must author and
install. It has three parts: the **skill directory contract** (what a
well-formed skill looks like and where it gets installed), the **CLI
contract** (exact input/output JSON shapes for every mode), and the **grading
rubric** (what the verifier checks).

Everything here is self-contained — you do not need any external package or
network access. Bun is preinstalled; `git` and `jq` are available.

---

## 1. Skill directory contract

A skill is a directory containing, at minimum, a `SKILL.md` file:

```
git-context/
├── SKILL.md            # required: YAML frontmatter + Markdown body
└── scripts/
    └── git-context     # the CLI script (or git-context.ts)
```

### 1.1 SKILL.md

`SKILL.md` must contain YAML frontmatter between `---` delimiters, followed by
a Markdown body:

```markdown
---
name: git-context
description: <what the skill does and when to use it>
---

# Git Context

<body: instruct an agent how and when to invoke the script>
```

Frontmatter rules:

- `name` is **required**, must be `git-context` — exactly matching the skill
  directory's name. Only lowercase letters, digits, and hyphens; 1–64
  characters; no leading/trailing/consecutive hyphens.
- `description` is **required**, non-empty (1–1024 characters). It should
  describe both what the skill does and when to use it.
- Additional optional fields (e.g. `license`, `compatibility`,
  `allowed-tools`) are permitted.

Body rules:

- Non-empty Markdown that instructs an agent how to invoke the script
  (invocation form, modes, when to use which mode) and where the script lives
  relative to the skill directory (`scripts/git-context`).

### 1.2 CLI script

- Lives at `scripts/git-context` or `scripts/git-context.<ext>` where ext is
  one of `ts`, `mts`, `js`, `mjs`, `sh`.
- Must be **executable** (`chmod +x`). For a Bun/TypeScript script the
  shebang must be `#!/usr/bin/env bun`.
- Must be self-contained: only the Bun standard library, `node:*` builtins,
  and the `git`/`jq` executables may be invoked. No npm packages (there is no
  network and no registry cache).

## 1.2.1 Install locations (AgentSkills discovery convention)

Install the skill so a compliant agent discovers it:

- **Project-level (primary):** `/app/.agents/skills/git-context/` — a
  `SKILL.md` must exist at `/app/.agents/skills/git-context/SKILL.md`.
- **User-level (optional):** `~/.agents/skills/git-context/`.

If both exist, project-level wins (project overrides user on collision). The
verifier resolves the project-level location first and falls back to
user-level only when project-level is missing.

---

## 2. CLI contract

### 2.1 Invocation

- Input: a single JSON string as the **first positional argument**, or JSON on
  **stdin** when no positional argument is given.
- Output: exactly one JSON object on stdout (pretty-printed or compact — both
  are accepted).
- Exit codes: `0` on success; **non-zero** for invalid input (unparseable
  JSON, unknown `mode`, missing required fields such as `base`, or a `paths`
  entry that escapes the repository root). On those failures nothing valid is
  required on stdout.

### 2.2 Common conventions

- Every mode input is an object discriminated by its `mode` field.
- Every mode accepts an optional `cwd` (string, default `"."`) — the working
  directory used to locate the repository. The repository root is resolved
  with `git rev-parse --show-toplevel`.
- All repository paths in output (file lists, changed files, worktree paths)
  are **repo-relative POSIX paths** (forward slashes, no leading `./`), with
  two exceptions: `repoRoot` is absolute, and `currentWorktree` for the repo
  root itself is `"."`.
- File lists are sorted lexicographically.

### 2.3 Mode: `status`

Input:

```json
{ "mode": "status", "cwd": "/abs/path/to/repo" }
```

`cwd` optional. Output (all fields required):

```json
{
  "ok": true,
  "mode": "status",
  "repoRoot": "/abs/repo/root",
  "branch": "feature/agent-work",
  "head": "<40-hex sha of HEAD>",
  "upstream": null,
  "dirty": {
    "isDirty": true,
    "stagedCount": 1,
    "unstagedCount": 1,
    "untrackedCount": 1,
    "stagedFiles": ["src/staged.ts"],
    "unstagedFiles": ["src/tracked.ts"],
    "untrackedFiles": ["notes.txt"]
  },
  "warnings": [],
  "suggestedNextCommands": []
}
```

Semantics:

- `branch`: current branch name, or `null` when HEAD is detached
  (`git branch --show-current`).
- `upstream`: upstream tracking ref name (e.g. `origin/main`), or `null` when
  none is configured.
- `dirty` classifications per file (a file can appear in more than one list):
  - **staged**: any change recorded in the index
    (`git diff --cached --name-only` is an acceptable truth source).
  - **unstaged**: tracked files with working-tree changes
    (`git diff --name-only`).
  - **untracked**: files git does not track, discovered with
    `--untracked-files=all` semantics — files inside untracked directories
    are listed individually, not as a directory.
- `isDirty` is true when any of the three lists is non-empty.
- `warnings` and `suggestedNextCommands` are arrays of strings (may be
  empty); their content is not graded.

### 2.4 Mode: `history`

Input:

```json
{
  "mode": "history",
  "cwd": "/abs/path/to/repo",
  "base": "dev",
  "paths": ["src/tracked.ts"],
  "limit": 20
}
```

- `base` **required**: a ref (branch, tag, or SHA) to compute history against.
- `paths` optional, default `[]` — scopes per-path history.
- `limit` optional, default `20`, maximum `200` — caps the commits returned
  overall **and** per path.

Output (all fields required):

```json
{
  "ok": true,
  "mode": "history",
  "repoRoot": "/abs/repo/root",
  "base": "dev",
  "baseHead": "<40-hex sha of base ref, or null when unresolvable>",
  "mergeBase": "<40-hex sha of git merge-base HEAD <base>, or null>",
  "paths": ["src/tracked.ts"],
  "commitsSinceBase": [
    {
      "fullSha": "<40-hex>",
      "shortSha": "<7+ hex>",
      "committedAt": "<ISO-8601 timestamp>",
      "subject": "feat: add tracked module"
    }
  ],
  "changedFilesSinceBase": [
    { "status": "A", "rawStatus": "A", "path": "src/tracked.ts" }
  ],
  "pathHistory": [
    {
      "path": "src/tracked.ts",
      "commits": [{ "fullSha": "...", "shortSha": "...", "committedAt": "...", "subject": "..." }]
    }
  ],
  "summary": {
    "commitCountSinceBase": 1,
    "changedFileCountSinceBase": 1,
    "deletedFileCountSinceBase": 0
  },
  "warnings": [],
  "suggestedNextCommands": []
}
```

Semantics:

- History is computed from the **merge-base**, not from the base ref head:
  - `mergeBase` = `git merge-base HEAD <base>` (null when either side is
    unresolvable).
  - `commitsSinceBase` = commits in `mergeBase..HEAD`, newest first
    (`committedAt` is the committer date in ISO-8601, i.e.
    `git log --date=iso-strict` format; `shortSha` is git's default
    abbreviation).
  - `changedFilesSinceBase` = `git diff --name-status <mergeBase>...HEAD`
    rows: `status` is the first letter of the raw status (`A`, `C`, `D`, `M`,
    `R`, `T`, `U`, or `X`); `rawStatus` is the full raw code (e.g. `R100`);
    for copies/renames include `oldPath` (the source path) alongside `path`.
- `pathHistory`: one entry per input `paths` value (same order, repo-relative
  and validated), each with that path's commit list (`git log -- <path>`,
  capped at `limit`).
- `summary.deletedFileCountSinceBase` counts `D`-status rows in the full
  changed-file set.
- If a `paths` entry resolves outside the repository root, the CLI must exit
  non-zero with an error mentioning that the path escapes the repository
  root.
- If `base` cannot be resolved, `baseHead` and `mergeBase` are `null`,
  `commitsSinceBase` and `changedFilesSinceBase` are empty, and exit code is
  still `0`.

### 2.5 Mode: `worktrees`

Input:

```json
{ "mode": "worktrees", "cwd": "/abs/path/to/repo" }
```

Output (all fields required):

```json
{
  "ok": true,
  "mode": "worktrees",
  "repoRoot": "/abs/repo/root",
  "currentWorktree": ".",
  "worktrees": [
    {
      "path": ".",
      "head": "<40-hex sha>",
      "branch": "refs/heads/feature/agent-work",
      "detached": false,
      "bare": false,
      "lockedReason": null,
      "prunableReason": null,
      "exists": true,
      "isCurrent": true
    }
  ],
  "warnings": [],
  "suggestedNextCommands": []
}
```

Semantics:

- Parses `git worktree list --porcelain`. One entry per worktree.
- `path` is repo-relative for worktrees inside the repo, otherwise absolute
  (linked worktrees typically live outside the repo root — use the absolute
  path then).
- `branch` is the full ref (e.g. `refs/heads/dev`) as reported by porcelain,
  or `null` when detached.
- `lockedReason`/`prunableReason` are the porcelain lock/prune reason strings
  or `null` (a bare `locked`/`prunable` line means reason `""`).
- `exists`: whether the worktree path exists on disk. `isCurrent`: whether
  that worktree is the one containing `cwd`. Exactly one entry has
  `isCurrent: true`.
- `currentWorktree`: `"."` for the repo root (it is the repo-relative path of
  the current worktree).

### 2.6 Mode: `context`

Input:

```json
{
  "mode": "context",
  "cwd": "/abs/path/to/repo",
  "base": "dev",
  "paths": [],
  "limit": 20,
  "includeWorktrees": true
}
```

- Combines `status` + `history` in one call. `base` required; `paths`,
  `limit` as in `history`; `includeWorktrees` optional boolean, default
  `false`.

Output: the union of the status and history fields (all required), plus:

```json
{
  "ok": true,
  "mode": "context",
  "repoRoot": "...",
  "branch": "...",
  "head": "...",
  "upstream": null,
  "base": "dev",
  "baseHead": "...",
  "mergeBase": "...",
  "dirty": { "...": "same shape as status.dirty" },
  "commitsSinceBase": ["...same as history"],
  "changedFilesSinceBase": ["...same as history"],
  "pathHistory": ["...same as history"],
  "worktrees": [],
  "summary": {
    "commitCountSinceBase": 1,
    "changedFileCountSinceBase": 1,
    "deletedFileCountSinceBase": 0,
    "worktreeCount": 0
  }
}
```

**Key edge case:** `worktrees` must be populated **only** when
`includeWorktrees` is `true` (same shape as the `worktrees` mode entries).
When absent or `false`, `worktrees` is `[]` and `summary.worktreeCount` is
`0` — even if the repository has linked worktrees. `summary.worktreeCount`
equals the number of entries in `worktrees`.

---

## 3. Fixtures for self-testing

A deterministic git fixture builder is installed at
`/opt/fixtures/build-git-fixture.sh`. Invoke it with a target directory; it
creates a repo with:

- branch `dev` with a baseline commit (`README.md`, `src/baseline.ts`),
- branch `feature/agent-work` (checked out, HEAD) with one commit adding
  `src/tracked.ts`,

both with pinned identity and dates, so SHAs are stable across rebuilds. It
prints the created path. Typical use:

```bash
/opt/fixtures/build-git-fixture.sh /tmp/myrepo
cd /tmp/myrepo
printf 'export const staged = true\n' > src/staged.ts && git add src/staged.ts
bun /path/to/your/script.ts '{"mode":"status","cwd":"/tmp/myrepo"}'
```

The grader rebuilds a fresh fixture this way, applies its own staged /
unstaged / untracked mutations and a linked worktree, computes expected
values from `git` directly, and compares your CLI's output against them.

---

## 4. Grading rubric

The verifier produces `/logs/verifier/reward.json`:

```json
{
  "reward": 0.75,
  "skill_valid": 1,
  "cli_accuracy": 0.75,
  "checks_passed": 9,
  "checks_total": 12,
  "installed_project_level": 1,
  "installed_user_level": 0
}
```

**Layer 1 — discovery + skill validity (gates the reward).** If any of these
fail, `skill_valid` is `0` and the final `reward` is `0`:

1. A skill directory named `git-context` is installed at
   `/app/.agents/skills/git-context/` (or `~/.agents/skills/git-context/`).
2. `SKILL.md` exists; frontmatter parses as YAML; `name` is `git-context`
   (matches the directory, lowercase/digits/hyphens, ≤64 chars);
   `description` is non-empty; the body is non-empty.
3. A CLI script exists under `scripts/` and is executable.

**Layer 2 — CLI behavioral correctness (graded fraction).** With
`skill_valid = 1`, the verifier runs your CLI against freshly built fixtures
and recomputes truth from git (12 checks):

1. `status` core identity: `repoRoot`, `branch`, `head` match git.
2. `status` staged-file detection.
3. `status` unstaged-file detection.
4. `status` untracked-file detection.
5. `history` resolves `baseHead` and `mergeBase` correctly.
6. `history` `commitsSinceBase` matches `git log mergeBase..HEAD` (count,
   subjects, SHAs).
7. `history` `changedFilesSinceBase` matches
   `git diff --name-status mergeBase...HEAD` (paths + statuses).
8. `history` `pathHistory` returns commits for each requested path.
9. `worktrees` lists every worktree with `isCurrent`/`exists` correct and
   `currentWorktree` = `"."`.
10. `context` without `includeWorktrees`: `worktrees` is `[]` and
    `worktreeCount` is `0` even when linked worktrees exist.
11. `context` with `includeWorktrees: true`: worktree entries match
    `git worktree list`.
12. Input validation: `history` without `base` exits non-zero.

`cli_accuracy = checks_passed / checks_total`; the final `reward` is
`skill_valid * cli_accuracy`.
