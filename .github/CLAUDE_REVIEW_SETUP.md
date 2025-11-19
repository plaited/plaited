# Claude PR Review Setup

This repository uses [claude-code-action](https://github.com/anthropics/claude-code-action) to automate PR code reviews with Claude.

## Prerequisites

- Repository admin access
- Anthropic API key

## Setup Instructions

### 1. Configure Anthropic API Key

1. Go to your repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `ANTHROPIC_API_KEY`
4. Value: Your Anthropic API key (get one at https://console.anthropic.com)
5. Click **Add secret**

### 2. Quick Setup (Alternative)

If you have Claude Code CLI installed:

```bash
claude
/install-github-app
```

This will guide you through installing the GitHub app and configuring secrets automatically.

## Workflows

### Automatic Review (Internal Contributors)

**File**: `.github/workflows/claude-pr-review.yml`

**Triggers**: Automatically on PR events for internal contributors
- `opened` - New PR created
- `synchronize` - PR updated with new commits
- `reopened` - PR reopened
- `ready_for_review` - PR marked ready for review

**Who**: Only runs for:
- Repository owner (`OWNER`)
- Organization members (`MEMBER`)

**What it reviews**:
- Code style and patterns from CLAUDE.md
- Test coverage and naming conventions
- Architecture alignment (behavioral programming, Shadow DOM)
- TSDoc standards
- Security vulnerabilities
- Performance considerations

**Output**: Comments inline and at PR level via GitHub PR comments

### Manual Review (External Contributors)

**File**: `.github/workflows/claude-external-review.yml`

**Trigger**: Manual via GitHub Actions UI

**How to use**:
1. Go to **Actions** tab in GitHub
2. Select **Claude PR Review (External - Manual)** workflow
3. Click **Run workflow**
4. Enter the PR number
5. Click **Run workflow**

**Who**: For external contributors and collaborators (COLLABORATOR, FIRST_TIME_CONTRIBUTOR, CONTRIBUTOR, or anyone outside the organization)

**Why manual**: Security best practice - review external code before running automation. Also used for direct collaborators who are not organization members.

**What it reviews**:
- Same standards as internal review
- Additional focus on test coverage
- Breaking changes
- License compliance
- Uses welcoming, constructive tone

## Review Standards

Both workflows enforce Plaited's coding standards from CLAUDE.md:

### Code Style
- Arrow functions over function declarations
- `type` over `interface`
- No `any` types (use proper types or `unknown`)
- PascalCase for types and schemas
- Correct terminology: "templates" not "components"

### Testing
- `*.spec.{ts,tsx}` - Unit/integration tests (Bun)
- `*.stories.tsx` - Browser template tests (workshop CLI)
- Use `test` not `it`

### Architecture
- Behavioral programming patterns
- Shadow DOM with `bElement`
- CSS-in-JS via `css` namespace
- Signal patterns (`useSignal`, `useComputed`)

### Documentation
- TSDoc for public APIs
- No `@example` sections
- Factory functions only (no raw `yield`)
- Cross-references with `@see` tags

### Security
- No OWASP top 10 vulnerabilities
- No security risks (XSS, injection, etc.)

## Troubleshooting

### Workflow not running

**Check**:
- Is `ANTHROPIC_API_KEY` secret configured?
- For internal reviews: Is the PR author the repo owner or an organization member?
- For external reviews: Did you manually trigger the workflow?

### API key errors

**Solutions**:
- Verify the API key is valid at https://console.anthropic.com
- Check the secret name is exactly `ANTHROPIC_API_KEY`
- Ensure the key has sufficient quota

### Review quality issues

**Improvements**:
- Update the prompts in the workflow files to add specific guidance
- Add more context from CLAUDE.md to the review focus areas
- Adjust the `claude_args` to allow/restrict specific tools

## Customization

### Modify review prompts

Edit the workflow files to adjust:
- Review focus areas
- Tone and style
- Specific standards to check

### Change triggers

For internal reviews, modify the `on:` section in `claude-pr-review.yml`:

```yaml
on:
  pull_request:
    types: [opened, synchronize]  # Remove reopened, ready_for_review if desired
```

### Adjust permissions

Both workflows use minimal permissions:
- `contents: read` - Read repository code
- `pull-requests: write` - Post comments
- `id-token: write` - Authentication

## Resources

- [claude-code-action Documentation](https://github.com/anthropics/claude-code-action)
- [Solutions Guide](https://github.com/anthropics/claude-code-action/blob/main/docs/solutions.md)
- [Anthropic Console](https://console.anthropic.com)
