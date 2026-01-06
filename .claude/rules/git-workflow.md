# Git Workflow

## Commit Message Format

When creating commits with multi-line messages, use single-quoted strings instead of heredocs. The sandbox environment restricts temp file creation needed for heredocs.

```bash
# ✅ CORRECT: Single-quoted multi-line string
git commit -m 'refactor: description here

Additional context on second line.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>'

# ❌ WRONG: Heredoc syntax (fails in sandbox)
git commit -m "$(cat <<'EOF'
refactor: description here
EOF
)"
```

The heredoc approach fails with:
```
(eval):1: can't create temp file for here document: operation not permitted
```

## Commit Conventions

This project follows conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code changes that neither fix bugs nor add features
- `docs:` - Documentation only changes
- `chore:` - Maintenance tasks
- `test:` - Adding or updating tests
