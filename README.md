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
- [@plaited/token-transformer](libs/token-transformer/README.md): transform token into outputs suitable for CSS and Typescript usage
- [@plaited/token-schema](libs/token-schema/README.md): create a JSON schema from design tokens that locks in values and allows addition of news values
- [@plaited/token-types](libs/token-types/README.md): types for plaited design tokens based on [design token format](https://design-tokens.github.io/community-group/format/)
- [@plaited/utils](libs/utils/README.md): platform agnostic utility functions
- [@plaited/workshop](libs/workshop/README.md): ssr development server for plaited component stories
  - livereload on src directory changes
  - codegen playwright test file for each story: visual regression, accessibility test, and interaction test (via play callback on stories).

## Dev Requirements

### local
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
