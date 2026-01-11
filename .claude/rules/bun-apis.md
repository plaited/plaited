# Bun Platform APIs

**IMPORTANT**: Prefer Bun's native APIs over Node.js equivalents when running in the Bun environment.

## File System Operations

- ✅ Use `Bun.file(path).exists()` instead of `fs.existsSync()`
- ✅ Use `Bun.file(path)` API for reading/writing files
- ✅ Use `Bun.write()` for efficient file writes

```typescript
// ✅ Good: Bun APIs
const exists = await Bun.file('config.json').exists()
const content = await Bun.file('data.txt').text()
await Bun.write('output.json', JSON.stringify(data))

// ❌ Avoid: Node.js equivalents
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
const exists = existsSync('config.json')
```

## Shell Commands

- ✅ Use `Bun.$` template literal for shell commands
- ❌ Avoid `child_process.spawn()` or `child_process.exec()`

```typescript
// ✅ Good: Bun shell
await Bun.$`npm install`
const result = await Bun.$`git status`.text()

// ❌ Avoid: Node.js child_process
import { spawn } from 'node:child_process'
spawn('npm', ['install'])
```

## Path Resolution

- ✅ Use `Bun.resolveSync()` for module resolution
- ✅ Use `import.meta.dir` for current directory
- ⚠️ Keep `node:path` utilities for path manipulation (join, resolve, dirname)

```typescript
// ✅ Good: Bun + node:path combo
import { join } from 'node:path'
const configPath = join(import.meta.dir, 'config.json')
const resolved = Bun.resolveSync('./module', import.meta.dir)
```

## Package Management

- ✅ Use `Bun.which(cmd)` to check for executables
- ⚠️ No programmatic package manager API yet - use CLI commands via `Bun.$`

```typescript
// ✅ Good: Check for executable
const bunPath = Bun.which('bun')
if (!bunPath) throw new Error('bun not found')

// Install packages via shell
await Bun.$`bun add zod`
```

## Environment Detection

- ✅ Check `typeof Bun !== 'undefined'` for Bun runtime
- ✅ Use `Bun.which('bun')` to verify bun executable exists

## When to Use Node.js APIs

- Interactive input (readline)
- Complex path manipulation (prefer `node:path` utilities)
- APIs without Bun equivalents

## Documentation

- Main docs: https://bun.sh/docs
- Shell API: https://bun.sh/docs/runtime/shell
- File I/O: https://bun.sh/docs/api/file-io
- Runtime APIs: https://bun.sh/docs/runtime/bun-apis
