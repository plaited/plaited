# threads/

Plugin-shipped behavior-thread files are discovered here.

The kernel's own turn-loop thread stays in `src/kernel/threads.ts` (Q3/C-revised).
This directory holds plugin-authored behavioral threads — not the core
framework loop.

As of v0.0.1, no plugin-shipped threads exist yet. The directory is an
empty placeholder; the loader discovers files here when they are added.
