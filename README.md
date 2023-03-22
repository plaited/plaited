# [WIP] plaited

Web application interfaces are inherently reactive and complex. Business needs
are not always clear at the beginning of a project. Untangling code as
requirements change is a frustrating process. However what if we could begin
working on new interface projects comfortable in our uncertainty while building
out production ready code?

## Main module

`https://deno.land/x/plaited/mod.ts`

A set of components and patterns for rapidly coding and refining web application
web applications as specifications (requirements) change and evolve.

## Assert module

`https://deno.land/x/plaited/assert.ts`

A small assertion library for running test in the browser with useful chained
helpers
[Eric Elliott's RITE pattern](https://medium.com/javascript-scene/what-every-unit-test-needs-f6cd34d9836d)

Simple, readable, helpful unit tests.

- Readable
- Isolated/Integrated
- Thorough
- Explicit

## CLI module

`https://deno.land/x/plaited/cli.ts`

Cli script to be used with deno to transform design tokens and generate design
token schemas

### Token Utils

- Transforms a design tokens object of the type DesignTokenGroup to TS and CSS.
  Allows extension of type DesignTokenGroup and supplying ones owns CSS and TS
  formatters.

- Generates a JSON schema that allows new design token values in but fixes
  current values until another schema is generated.

## Server module

`https://deno.land/x/plaited/server.ts`

A simple but capable file server with https, static file serving, live
reloading, gzip and other useful features to support modern web app development
on localhost and over a local network.

## Utils module

`https://deno.land/x/plaited/utils.ts`

Reusable platform agnostic utility functions and types used to build plaited
experiences
