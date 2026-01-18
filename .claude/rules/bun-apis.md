# Bun APIs

Prefer Bun's native APIs over Node.js equivalents for better performance and simpler code.

## File Operations

```typescript
// ✅ Reading files
const content = await Bun.file('path/to/file').text()
const json = await Bun.file('path/to/file').json()
const bytes = await Bun.file('path/to/file').arrayBuffer()

// ❌ Avoid Node.js fs
import { readFile } from 'fs/promises'
const content = await readFile('path/to/file', 'utf-8')
```

```typescript
// ✅ Writing files
await Bun.write('path/to/file', content)
await Bun.write('path/to/file', JSON.stringify(data, null, 2))

// ❌ Avoid Node.js fs
import { writeFile } from 'fs/promises'
await writeFile('path/to/file', content)
```

## Shell Commands

```typescript
// ✅ Shell commands with Bun.$
const result = await Bun.$`git status`.text()
const { stdout, exitCode } = await Bun.$`npm run build`.quiet()

// ✅ With environment variables
await Bun.$`NODE_ENV=production bun run build`

// ❌ Avoid child_process
import { exec } from 'child_process'
```

## Path Resolution

```typescript
// ✅ Current directory
const dir = import.meta.dir
const file = import.meta.file
const path = import.meta.path

// ✅ Resolve relative paths
const configPath = `${import.meta.dir}/config.json`

// ❌ Avoid __dirname (requires esm shim)
```

## File Existence Checks

```typescript
// ✅ Check if file exists
const exists = await Bun.file('path').exists()

// ✅ Get file stats
const file = Bun.file('path')
const size = file.size
const type = file.type

// ❌ Avoid fs.stat for existence checks
```

## Environment Variables

```typescript
// ✅ Bun automatically loads .env files
const apiKey = Bun.env.API_KEY

// ✅ Or use process.env (both work in Bun)
const apiKey = process.env.API_KEY
```

## Glob Patterns

```typescript
// ✅ Native glob support
const glob = new Bun.Glob('**/*.ts')
for await (const file of glob.scan('.')) {
  console.log(file)
}

// ✅ Sync scanning
const files = Array.from(glob.scanSync('.'))
```
