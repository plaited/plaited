# Skill Activation

**Evaluate on every prompt** - Before any response, tool call, or action, check available skills for relevance

**Activation sequence:**

1. **Evaluate** - For each skill in `<available_skills>`, assess: `[skill-name] - YES/NO - [reason]`
2. **Activate** - Call `Skill(skill-name)` for each relevant skill before proceeding
3. **Respond** - Begin response only after activation is complete

**Applies to all tasks** - Research, explanation, code changes, debugging, review — no exceptions

**Decision-point re-evaluation** - Re-evaluate skills at each planning or delegation step:
- Before entering plan mode
- Before launching subagents (Task tool)
- Before starting each task in a task list
- When the domain shifts mid-task (e.g., from code to evaluation, from schema to grading)

*Verify:* Every Task tool call and plan mode entry was preceded by skill evaluation
*Fix:* Pause, evaluate skills, activate relevant ones, then continue

**Example:**
```
- code-patterns: NO - not writing code
- git-workflow: YES - need commit conventions
- documentation: YES - writing README

> Skill(git-workflow)
> Skill(documentation)
```

**Activation before action** - Evaluating skills without calling `Skill()` provides no benefit
*Verify:* Check that `Skill()` was called for each YES evaluation
*Fix:* Call `Skill(skill-name)` for skipped activations
