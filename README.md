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

## Workshop module

`https://deno.land/x/plaited/workshop.ts`

A frontend workshop for building components,
[islands](https://jasonformat.com/islands-architecture/), and pages in
isolation.

## Server module

`https://deno.land/x/plaited/server.ts`

A simple but capable file server with https, static file serving, live
reloading, gzip and other useful features to support modern web app development
on localhost and over a local network.

## Token transformer

`https://deno.land/x/plaited/token-transformer.ts`

Transforms a design tokens object of the type DesignTokenGroup to TS and CSS.
Allows extension of type DesignTokenGroup and supplying ones owns CSS and TS
formatters.

## Easy token schema module

`https://deno.land/x/plaited/easy-token-schema.ts`

Generates a JSON schema that allows new design token values in but fixes current
values until another schema is generated.

## Utils

`https://deno.land/x/plaited/utils.ts`

Reusable platform agnostic utility functions and types used to build plaited
experiences
