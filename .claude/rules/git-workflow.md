# Git Workflow

Commit conventions and version control practices for consistent history.

## Conventional Commits

Use semantic prefixes for all commit messages:

| Prefix | Purpose |
|--------|---------|
| `feat:` | New feature or capability |
| `fix:` | Bug fix |
| `refactor:` | Code change that neither fixes nor adds |
| `docs:` | Documentation only |
| `chore:` | Maintenance, dependencies, config |
| `test:` | Adding or updating tests |
| `style:` | Formatting, whitespace (no code change) |
| `perf:` | Performance improvement |

## Commit Message Format

```bash
# Single-line for simple changes
git commit -m "fix: resolve null pointer in user validation"

# Multi-line with HEREDOC for complex changes
git commit -m "$(cat <<'EOF'
feat: add user authentication flow

- Implement JWT token generation
- Add refresh token rotation
- Include rate limiting on auth endpoints

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Message Guidelines

1. **Subject line**: Imperative mood, no period, under 72 chars
   - ✅ "add user validation"
   - ❌ "added user validation."

2. **Body**: Explain *why* not *what* (the diff shows what)

3. **Scope**: Optional but useful for large codebases
   - `feat(auth): add OAuth2 support`
   - `fix(api): handle timeout errors`

## Pre-commit Checks

Before committing, ensure:
```bash
# Type, lint, and format check
bun run check

# Or auto-fix issues first
bun run check:write
```

## Branch Naming

```
feat/add-user-auth
fix/null-pointer-validation
refactor/simplify-api-client
docs/update-readme
chore/bump-dependencies
```

## Sandbox Workarounds

When running in Claude Code's sandbox environment:

1. **Git config**: The sandbox may not have git user configured
   - Use `--no-gpg-sign` if GPG signing fails
   - Avoid `git config --global` commands

2. **File permissions**: Some operations may be restricted
   - Check error messages for sandbox-related blocks
   - Request sandbox override only when necessary
