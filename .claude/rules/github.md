# GitHub CLI

Prefer the `gh` CLI for GitHub operations over API calls or WebFetch.

## Why Use gh CLI

1. **Authentication**: Uses existing GitHub credentials
2. **Pagination**: Handles large result sets automatically
3. **Type safety**: Structured JSON output with `--json`
4. **Simpler**: No URL construction or token management

## Pull Requests

```bash
# Create PR
gh pr create --title "feat: add auth" --body "Description here"

# Create PR with template
gh pr create --title "feat: add auth" --body "$(cat <<'EOF'
## Summary
Brief description

## Test Plan
- [ ] Unit tests pass
- [ ] Manual testing done
EOF
)"

# List PRs
gh pr list
gh pr list --state open --author @me

# View PR details
gh pr view 123
gh pr view 123 --json title,body,reviews

# Review PR
gh pr review 123 --approve
gh pr review 123 --request-changes --body "Please fix X"

# Checkout PR locally
gh pr checkout 123
```

## Issues

```bash
# Create issue
gh issue create --title "Bug: X fails" --body "Steps to reproduce..."

# List issues
gh issue list
gh issue list --label bug --state open

# View issue
gh issue view 456
gh issue view 456 --json title,body,comments

# Close issue
gh issue close 456 --comment "Fixed in #123"
```

## JSON Output Fields

Common `--json` fields for structured output:

```bash
# PR fields
gh pr view 123 --json number,title,body,state,author,reviews,commits,files

# Issue fields
gh issue view 456 --json number,title,body,state,author,labels,comments

# List with specific fields
gh pr list --json number,title,author --jq '.[] | "\(.number): \(.title)"'
```

## Repository Operations

```bash
# Clone repository
gh repo clone owner/repo

# View repo info
gh repo view
gh repo view --json name,description,url

# Create repo
gh repo create my-project --public --clone
```

## Actions and Checks

```bash
# View workflow runs
gh run list
gh run view 12345

# View check status on PR
gh pr checks 123

# Re-run failed jobs
gh run rerun 12345 --failed
```

## Best Practices

1. **Use `--json`** for parsing: Avoid regex on human-readable output
2. **Use `--jq`** for filtering: Combine with JSON output for precise data
3. **Check exit codes**: `gh` returns non-zero on errors
4. **Prefer specific commands**: Use `gh pr` over raw API calls
