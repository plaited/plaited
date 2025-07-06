# Parallel tasks execution

L to chat, K to generate

ARGUMENTS: $ARGUMENTS

## Step 1: Setup git worktree

Let's firstly setup a few git worktrees in 'trees' folder depends on number of parallel agents needed, so we can have different sandbox environment for experimentation

Run `git worktree add -b branch-name ./trees/branch-name`

Replace branch-with a good name that reflect the meaning

After that, for each branch, we should go into the folder (with absolute path) and do `bun install` to setup

## Step 2: Start Parallel sub agents

We're going to create N new subagents that use the Task tool to execute in each git worktree  in parallel.

This enables use to concurrently build the feature in parallel so we can test and validate each subagent's changes in isolation then pick the best changes.

The first agent will run in trees/<branch-name-1>/

The second agent will run in trees/<branch-name-2>/

The last agent will run in trees/<branch-name-n>/

The code in each trees will be identical to the code in the current branch. It will be setup and ready for you to build the feature end to end.

Each agent will independently implement the engineering plan based on task in their respective workspace.

When the subagent completes it's work, have the subagent to report their final changes made in a comprehensive `[RESULTS.md](http://results.md/) file at the root of their respective workspace.

Make sure agents don't run any other script that would start the server or client

focus on the code changes only.
