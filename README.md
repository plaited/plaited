# [WIP] plaited

Web application interfaces are inherently reactive and complex. Business needs
are not always clear at the beginning of a project. Untangling code as
requirements change is a frustrating process. However what if we could begin
working on new interface projects comfortable in our uncertainty and build out
solid production ready code?

## Main module

`https://deno.land/x/plaited/mod.ts`

A set of components and patterns for rapidly coding and refining web application
web applications as specifications (requirements) change and evolve.

## Server module

`https://deno.land/x/plaited/server.ts`

A simple but capable file server with https, static file serving, live
reloading, gzip and other useful features to support modern web app development
on localhost and over a local network.

## bundler module

`https://deno.land/x/plaited/bundler.ts`

A simple opinionated wrapper around esbuild and esbuild_deno_loader that makes
use in larger projects easy and caches bundles too for faster retrieval.

## Utils module

`https://deno.land/x/plaited/utils.ts`

Reusable platform agnostic utility functions and types used to build plaited
experiences

## CLI module

`https://deno.land/x/plaited/cli.ts`

Cli script to be used with deno Run to generate

### Workshop

A frontend workshop for building components,
[islands](https://jasonformat.com/islands-architecture/), and pages in
isolation.

### Token Transform

Transforms a design tokens object of the type DesignTokenGroup to TS and CSS.
Allows extension of type DesignTokenGroup and supplying ones owns CSS and TS
formatters.

### Token Schema

Generates a JSON schema that allows new design token values in but fixes current
values until another schema is generated.
