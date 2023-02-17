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

# 2/13/23 Doc session

**Goal of framework**

The Plaited Framework solves 80% of the problems developers who work with and
maintain design systems encounter. Engineers, Designers, and other project
stakeholders know what works for them and the teams they support. Tokens,
documentation styles, and best practices should not be governed by the opinions
of a framework. Plaited enables stakeholders to rapidly generate UI features
based on island architecture. Automatically, creating new UI elements from the
components being designed.

**What the Plaited include**

- A dedicated development server and production server that supports middleware
  functions
- A frontend DOM manipulation library akin to
  [Stimulus JS](https://stimulus.hotwired.dev/) and
  [Catalyst JS](https://catalyst.rocks/guide/introduction/)
- A workshop akin to storybook but structured to support generative ui needs of
  plaited
- A design token types in typescripts, a token transformation utility
- An easy design token schema generator utility
- A mostly node/npm fre experience save playwright which let's be honest if the
  best tool for browser testing right now
- Playwright test code generation based on stories written for Workshop.
- A chat interface that allows usage of [OpeanAI](https://openai.com/) api key
  to query your stories, docs, and design tokens to ask all kinds of question
  and generate potential island user interface code samples

**What the Plaited does not include**

- Strong opinions about project directory structure and routing like
  [Astro](https://astro.build/)

**Documentation example ideas**

- A whole webapp in a single file like this
  [deno example](https://deno.com/blog/a-whole-website-in-a-single-js-file-continued)
- A webapp that creates routes routes based on an array of file paths like
  workshop
- A webapp where you define your routes in a routes object with middleware
  function and pass it to server and use whatever directory structure you like
  best
- Setting up a tiered design system in a single repo
- Creating design tokens and good descriptions
- Writing good stories and descriptions
- Example of extending token types and token formatters
- Tired design system setup and management and metrics
