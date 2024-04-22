# [WIP] @plaited/modnet

- We import a component say `tic-tac-toe`
- We can render it with `ssr`
- How do we generate a bundle for this route?

## Generate Route

I like the idea of giving a url to a file that exports components and then it generates a bundle for each export but how would you name the route and everything else?

- Well we could take the storybook approach
- We could consider file routing
- We could use a file extension approach that's sort of like storybook and file routing?

I think the goal is to just make it easy to approach the routing and bundled routes.

So we need to define our entries and tree shake them.
We have routes for them now. Then we take these bundles and we can actually use them to render out pages or chile elements technically?

## Okay how do we want to define our entries?

Let's step back. We need a bundler that can also generate object we can use for routes. So we render out FunctionalTemplates and PlaitedTemplates and those are what we use to create html routes. Okay that's how we need to do this. We need to import just the default for creating the bundle and tree shake. basically a virtual import sorta a fake file that imports just the default from a module file that uses whatever our MSS is going to be.

## What is a module

- Frontend Plaited Element
- Backend server side code
- But it's more than that
- Each element has one route 
- It really doesn't matter if the route or domain changes
- We're going to use VC+DWN to lock down a UID
- We're also going to use it to limit which content a person can see on a module
- The permission content is rendered via slot obviously
- No that can't be true we can also use SSE and web sockets to send and render content that we allow too.
- What about my original SDUI ideas. Yeah that's promising loosely coupled might be the way to go. And if we're being honest file based routing is probably not the way to go at least not that way. - But how about this on the server side we simply need to import the files we're using for server side rendering. 

```tsx
import { ssr } from 'plaited/server'
import { Elysia } from 'elysia'
import { Island } from './registry'

new Elysia()
  .get('/', () => ssr(<Island />)) // this returns a string but what if 
  .listen(3000)

```

### Registry

#### Island

```tsx
import { Component } from 'plaited/client'

export const Island = Component({
  template: <slot></slot>
  tag: 'some-module'
})
```

Any element we want to be a module we simply give the module extension to. We filter the out these and grab export name and check that it's a Plaited Component based on it having a tag. We can also check for duplicate tags and send console warnings.

Okay so client code should be separate from server side none of that next js mess and it's actually easier for us because we can use the module name as  route honestly. This is because every module is a custom element it's name is unique. It can be associate with a unique DWN so even change the name is simply a matter of operations an making sure the new name doesn't conflict with an existing name. Further we can also use hashes once we get to generative level.



# Content is Code and Code is Content

A schema is used to describe content.

So we have DID,  Decentralized Identifier, document that we are going to use to

Data stored has a did and a schema



