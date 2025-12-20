# Bun API Preferences

**IMPORTANT**: Prefer Bun's native APIs over Node.js equivalents when running in Bun environment.

## File System Operations

- ✅ Use `Bun.file(path).exists()` instead of `fs.existsSync()`
- ✅ Use `Bun.file(path)` API for reading/writing files
- ✅ Use `Bun.write()` for efficient file writes

## Shell Commands

- ✅ Use `Bun.$` template literal for shell commands
- ❌ Avoid `child_process.spawn()` or `child_process.exec()`
- Example: `await Bun.$\`npm install\`` instead of spawn('npm', ['install'])

## Path Resolution

- ✅ Use `Bun.resolveSync()` for module resolution
- ✅ Use `import.meta.dir` for current directory
- ⚠️ Keep `node:path` utilities for path manipulation (join, resolve, dirname)

## Package Management

- ✅ Use `Bun.which(cmd)` to check for executables
- ⚠️ No programmatic package manager API yet - use CLI commands via `Bun.$`

## Environment Detection

- ✅ Check `typeof Bun !== 'undefined'` for Bun runtime
- ✅ Use `Bun.which('bun')` to verify bun executable exists

## When to Use Node.js APIs

- Interactive input (readline)
- Complex path manipulation (prefer node:path utilities)
- APIs without Bun equivalents

## Bun Documentation

- Main docs: https://bun.sh/docs
- Shell API: https://bun.sh/docs/runtime/shell
- File I/O: https://bun.sh/docs/api/file-io
- Runtime APIs: https://bun.sh/docs/runtime/bun-apis
