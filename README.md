[![Build/Tests](https://github.com/plaited/plaited/actions/workflows/tests.yml/badge.svg)](https://github.com/plaited/plaited/actions/workflows/tests.yml)

# plaited

This mono repo serves as the workspace for working on our plaited web interface development libraries and tooling. It is divided into 3 workspaces.

1. [libs](libs/README.md): Rendering libraries, utilities and tooling
2. [libs-storybook](libs-storybook/README.md): Storybook development libraries and tooling
3. [libs-token](libs-token/README.md): Design token format libraries and tooling
4. [libs-test](libs-test/README.md):Test libraries and tooling


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
