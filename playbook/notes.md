## Notes on things to check

- in [playwright config](src/workshop/templates/playwright.config.template.ts) I
  need to get the server start command right.

- Reserved route`/livereload`

- npm install -g commitlint @commitlint/config-conventional

- .registry in assets is a reserved directory

- this project uses conventional commits

```json
[
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test"
]
```

Plaited leverages
[behavioral programing](https://www.youtube.com/watch?v=PW8VdWA0UcA), along with
utility functions designed to assist with client side data storage and
communication, to enable us to design flexible frontend code where iteratively
adding new stuff doesn't require us to relearn or even fully understand a system
for fear of regressions and breakage. This is accomplished by using behavioral
strands. Using simple idioms we define our requirements and actions that are
fired off when our behavioral tracks (programs) select an event to occur.
