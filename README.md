# [WIP] plaited

Web application interfaces are inherently reactive and complex. Business needs
are not always clear at the beginning of a project. Untangling code as
requirements change is a frustrating process. However what if we could begin
working on new interface projects comfortable in our uncertainty and build out
solid production ready code?

## mod.ts

Plaited is framework for rapidly coding and refining web application interfaces
as specifications (requirements) change and evolve. Plaited leverages
[behavioral programing](https://www.youtube.com/watch?v=PW8VdWA0UcA), along with
utility functions designed to assist with client side data storage and
communication, to enable us to design flexible frontend code where iteratively
adding new stuff doesn't require us to relearn or even fully understand a system
for fear of regressions and breakage. This is accomplished by using behavioral
strands. Using simple idioms we define our requirements and actions that are
fired off when our behavioral tracks (programs) select an event to occur.

## Workshop (workshop.ts)

A frontend workshop for building components,
[islands](https://jasonformat.com/islands-architecture/), and pages in
isolation.

## Server (server.ts)

A simple but capable file server with https, static file serving, live
reloading, gzip and other useful features to support modern web app development
on localhost and over a local network.

## Token transformer (token-transformer.ts)

Transforms a design tokens object of the type DesignTokenGroup to TS and CSS.
Allows extension of type DesignTokenGroup and supplying ones owns CSS and TS
formatters.

## Easy token schema (easy-token-schema.ts)

Generates a JSON schema that allows new design token values in but fixes current
values until another schema is generated.

## Utils (utils.ts)

Reusable platform agnostic utility functions and types used to build plaited
experiences
