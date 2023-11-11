[![Build/Tests](https://github.com/plaited/plaited/actions/workflows/tests.yml/badge.svg)](https://github.com/plaited/plaited/actions/workflows/tests.yml)

# plaited

This mono repo serves as the workspace for working on our plaited web interface
development libraries.

## Libraries

### External usage

- [plaited](libs/plaited/README.md): plaited library package


### Internal usage

**The following libraries are not recommended for usage outside the Plaited organization. They are dependencies for our Plaited libs and apps. These libraries are open sourced as reference implementation. Take as a dependency at your own risk.**

- [@plaited/behavioral](libs/behavioral/README.md): implicit state management
  library using the behavioral programming algorithm
- [@plaited/component](libs/component/README.md): createComponent ui rending utility
- [@plaited/jsx](libs/jsx/README.md):
  - templating utility and types
  - css-in-js utility to enable templating utility's style hoisting pattern
  - data attribute constants for templating utility
  - server side rendering utility for templating utility
  - jsx runtime for templating utility
  - classNames utility function for conditionally joining css class names
  - stylesheets utility function for conditionally joining css-on-js utility function generated stylesheet objects

## Dev Requirements

### local

- bun >= 1.0.7

### devcontainer requirements

- vscode
- Docker

## Dev Setup

### local setup

1. Clone repository and ensure you have bun >= 1.0.7
2. Run `bunx playwright install`
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
