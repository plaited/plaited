# Accuracy & Confidence

Verification protocols and confidence thresholds for reliable code generation.

## Confidence Threshold: 95%

Before making changes, ensure 95% confidence in:

1. **Understanding the request**: Can you restate what the user wants?
2. **Knowing the codebase context**: Have you read relevant files?
3. **Correctness of the solution**: Will this work as intended?

### When Below 95% Confidence

- **Ask clarifying questions** before proceeding
- **Read more context** - use Glob/Grep to find related code
- **State assumptions explicitly** so user can correct them

## Verification Protocol

### Before Writing Code

1. **Read first**: Never modify files you haven't read
2. **Understand patterns**: Check existing code for conventions
3. **Verify types**: Use TypeScript LSP to check signatures

### After Writing Code

1. **Run checks**: `bun run check` for type/lint/format errors
2. **Run tests**: Verify changes don't break existing functionality
3. **Review diff**: Ensure only intended changes were made

## Uncertainty Signals

Use explicit language when uncertain:

```
✅ "I believe X because Y"
✅ "Based on the code I've read, this should..."
✅ "I'm not certain about X - should I investigate further?"

❌ "This will definitely work"
❌ "There's no way this could fail"
```

## Source Verification

When referencing documentation or APIs:

1. **Prefer codebase**: Check actual source over external docs
2. **Verify versions**: Ensure docs match installed versions
3. **Test assumptions**: Run code to verify behavior

## Error Recovery

When something goes wrong:

1. **Don't guess**: Read error messages carefully
2. **Check context**: Errors often reveal missing context
3. **Ask if stuck**: Better to clarify than compound errors
