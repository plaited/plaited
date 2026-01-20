# Git Workflow

## Commit Message Format

Use multi-line commit messages for detailed changes:

```bash
git commit -m "refactor: description here

Additional context on second line."
```

## Pre-commit Hooks

**Never use `--no-verify`** to bypass pre-commit hooks. If hooks fail, it indicates a real issue that must be fixed:

1. Investigate the error message
2. Fix the underlying issue (lint errors, format issues, test failures)
3. Re-run the commit

Using `--no-verify` masks problems and defeats the purpose of automated quality checks.

## Commit Conventions

Follow conventional commits format:
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code changes that neither fix bugs nor add features
- `docs:` - Documentation only changes
- `chore:` - Maintenance tasks
- `test:` - Adding or updating tests
