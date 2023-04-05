[![Tests](https://github.com/plaited/plaited/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/plaited/plaited/actions/workflows/tests.yml)

# [WIP] plaited

Web application interfaces are inherently reactive and complex. Business needs
are not always clear at the beginning of a project. Untangling code as
requirements change is a frustrating process. However what if we could begin
working on new interface projects comfortable in our uncertainty while building
out production ready code?

## Main module

`https://deno.land/x/plaited@0.1.0-rc/mod.ts`

A set of components and patterns for rapidly coding and refining web application
web applications as specifications (requirements) change and evolve.

## Rite module

`https://deno.land/x/plaited@0.1.0-rc/rite.ts`

A small test library for running test in the browser.

It includes a assert utility with usefull chained helpers inth
[Eric Elliott's RITE pattern](https://medium.com/javascript-scene/what-every-unit-test-needs-f6cd34d9836d)

Simple, readable, helpful unit tests.

- Readable
- Isolated/Integrated
- Thorough
- Explicit

It also includes a test runner exported as test. That will report pass fails.

## CLI module

`https://deno.land/x/plaited@0.1.0-rc/cli.ts`

Cli script to be used with deno to transform design tokens and generate design
token schemas

### Token Utils

- Transforms a design tokens object of the type DesignTokenGroup to TS and CSS.
  Allows extension of type DesignTokenGroup and supplying ones owns CSS and TS
  formatters.

- Generates a JSON schema that allows new design token values in but fixes
  current values until another schema is generated.

## Server module

`https://deno.land/x/plaited@0.1.0-rc/server.ts`

A simple but capable file server with https, static file serving, live
reloading, gzip and other useful features to support modern web app development
on localhost and over a local network.

## Utils module

`https://deno.land/x/plaited@0.1.0-rc/utils.ts`

Reusable platform agnostic utility functions and types used to build plaited
experiences

# Development

## Requirements

- Deno installed
- Node installed
  - `husky` and `@commitlint/config-conventional` installed globally for
    conventional commits
