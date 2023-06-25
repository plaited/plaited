Plaited Typedocs / [Exports](modules.md)

[![build/tests](https://github.com/plaited/plaited/actions/workflows/check-and-update-typedocs.yml/badge.svg?branch=main)](https://github.com/plaited/plaited/actions/workflows/check-and-update-typedocs.yml)

# plaited

This mono repo serves as the workspace for working on our plaited web interface
development libraries.

## Libraries

- [plaited](libs/plaited/README.md): primary plaited library package
- [@plaited/behavioral](libs/behavioral/README.md): implicit state management
  library using the behavioral programming algorithm
- [@plaited/jsx](libs/jsx/README.md):
  - templating utility and types
  - css-in-js utility to enable templating utility's style hoisting pattern
  - data attribute constants for templating utility
  - server side rendering utility for templating utility
  - jsx runtime for templating utility
- [@plaited/rite](libs/rite/README.md):
  [RITEway](https://www.npmjs.com/package/riteway) style testing framework for
  [@web/test-runner](https://www.npmjs.com/package/@web/test-runner)

## Dev Requirements

<<<<<<< HEAD
### local
=======
### local requirements

- Bun >= 0.5.9
>>>>>>> 6b79979ca9eafff6533e818e59ac429b3c592bfe
- Node 18.15.0

### devcontainer requirements

- vscode
- Docker

## Dev Setup

### local setup

1. Clone repository and ensure you have Node >= 18.15.0
2. Run `npx playwright install`
3. Run `bash setup.sh`

### devcontainer setup

1. Install docker on local machine
2. Ensure docker desktop daemon/app is running
3. Open new window for VSCode
4. `ctrl/cmd + shift + p`
5. search for **Dev Containers:Clone Repository in Container Volume**
6. Enter this repo name **plaited/plaited**
7. Wait for it to download and set everything up
8. Open a VSCode terminal tab and run `zsh setup.sh`
