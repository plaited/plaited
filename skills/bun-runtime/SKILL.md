---
name: bun-runtime
description: Use Bun for file/script operations — Bun.file, Bun.write, Bun.$ shell, child processes. Do not use Python or Node.js fs for file manipulation, generation, or concatenation.
license: ISC
compatibility: Requires `onbraid` CLI and network access
allowed-tools: Bash
---

# Bun Runtime Skill

## Two modes

This skill covers both **Bun API lookup** and **Bun-based file/script operations**. Use the
right tool for the task.

---

## Mode 1: API Documentation Lookup

Query the Bun documentation via MCP for API reference questions:

```bash
`onbraid mcp-client '{"mode":"call-tool","url":"https://bun.com/docs/mcp","tool":"search_bun","args":{"query":"Bun.file API"}}'
```

> [!CAUTION]
> **Common failure modes**
>
> 1. **Invalid JSON from special characters** — avoid unescaped backticks (`` ` ``),
>    unescaped double quotes, or raw newlines inside the JSON string argument. The
>    entire `'{}'` payload must be valid JSON. Use single quotes around the JSON blob
>    and escape any inner double quotes. Backticks inside the `query` value will break
>    JSON parsing — omit them or use `\``` ` ``\` if absolutely needed.
>
> 2. **Wrong URL** — the correct MCP endpoint is **`https://bun.com/docs/mcp`**,
>    not `bun.sh/api/mcp`. Using `bun.sh` returns a 404.

## Mode 2: File Operations & Scripting (THIS REPO)

**Always use Bun for scripting and file operations.** Do not use Python, Node.js `fs`,
or shell heredocs for file generation, concatenation, transformation, or any local
file scripting task.

When implementing a scripted solution, first search the Bun docs for a native Bun API
(Bun.file, Bun.write, Bun.$, Bun.spawn, etc.) rather than reaching for Node.js compat
pages (bun.com/docs/runtime/nodejs-compat). For operations where no Bun native API
exists (e.g., temporary directories), use the Node.js built-in via `os.tmpdir()` or
`os.mkdtempSync()` — Bun implements nearly all of `node:*`.

### Why

- AGENTS.md requires: **"Prefer Bun over Node.js"**
- Using Python or heredocs for file concatenation or generation creates brittle, error-prone workflows
  (quoting issues, truncation, invisible control characters)
- Bun has native APIs for file I/O that are concise and safe

### Available approaches (preferred order)

#### 1. Split into multiple files and re-export

If a single file grows too large for the `write` tool, split it into logical parts and use a
re-export boundary file. This follows the repo's module organization conventions
(`feature.ts` re-exports from parts):

```ts
// src/open-responses/open-responses.schemas.ts — all Zod schemas
// src/open-responses/open-responses.ts — re-exports + client implementation
```

No ad-hoc concatenation needed.

#### 2. Use `Bun.write` + `Bun.file` for file concatenation

```ts
// Write as: bun run -e "..."
bun run -e '
const parts = [
  Bun.file("part1.ts").text(),
  Bun.file("part2.ts").text(),
];
const combined = await Promise.all(parts);
await Bun.write("output.ts", combined.join("\n"));
'
```

#### 3. Use `Bun.$` for shell pipelines

```ts
bun run -e 'await Bun.$`cat part1.ts part2.ts > output.ts`.quiet()'
```

#### 4. Write a small temp script and run it

```ts
bun run /tmp/combine.ts  # where /tmp/combine.ts uses Bun.file/Bun.write
```

#### 5. Use `bun run -` for stdin-piped one-liners

For quick scripts without a temp file, pipe code through stdin:

```bash
echo 'await Bun.write("output.ts", `hello`);' | bun run -
```

Also works for reading from files:

```bash
bun run - < script.ts
```

#### 6. Use `Bun.spawnSync` for running external commands

When you need to run an external CLI tool and capture its output:

```ts
bun run -e '
const result = Bun.spawnSync(["git", "log", "--oneline", "-5"]);
console.log(result.stdout.toString());
'
```

Use `Bun.which()` to check if a command exists before spawning:
```ts
bun run -e '
if (Bun.which("onbraid")) {
  const result = Bun.spawnSync(["onbraid", "skills"]);
  console.log(result.stdout.toString());
}
'
```
```

### What NOT to do

- ❌ `python3 -c "..."` — never use Python for any file scripting or manipulation
- ❌ Heredocs with `cat > file << 'EOF'` — brittle with large content, truncation risk
- ❌ `node -e "fs.writeFileSync(...)"` — Bun API is required
- ❌ External Python scripts (`.py` files) for build steps or code generation — use `Bun.$` (shell) or `Bun.spawn` instead

## When to use Mode 1 (API lookup)

- Looking up Bun runtime APIs (`Bun.file`, `Bun.serve`, `Bun.$`)
- Checking bundler or test runner configuration
- Finding package manager commands or compatibility details
- Verifying Bun-specific behavior vs Node.js

## When to use Mode 2 (File operations)

- Generating, combining, or transforming any source files
- Any local file scripting task
- Concatenating file parts that don't fit the `write` tool's size limits
- Running external CLI tools or checking for executable availability

## See also

- `onbraid mcp-client --help` — discover all available MCP operations
- `onbraid mcp-client --schema input` — inspect the full input schema
- `AGENTS.md` — section on Bun APIs
