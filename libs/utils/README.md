# @plaited/utils

Common runtime agnostic utility functions and types used by plaited libraries.
[![Tests](https://github.com/plaited/utils/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/plaited/utils/actions/workflows/tests.yml)

## Dev Requirements

### local

- Bun >= 0.5.9

### devcontainer

- vscode
- Docker

## Dev Setup

### local

Clone repository and ensure you have bun >= 0.5.9 installed

Run `bash setup.sh`

### devcontainer

1. Install docker on local machine
2. Ensure docker desktop daemon/app is running
3. Open new window for VSCode
4. `ctrl/cmd + shift + p`
5. search for **Dev Containers:Clone Repository in Container Volume**
6. Enter this repo name **plaited/utils**
7. Wait for it to download and set everything up
8. Open a VSCode terminal tab and run `zsh setup.sh`
