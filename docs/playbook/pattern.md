A module is a full stack component. Where code is content and content is code 

It consist of a Component a route and server side logic around permmissions


## Boundary

When you create a module you're not going to be thinking about schemas. This is the first cognitive load we need to remove. You may describe what you're trying to create. An under the hood we're doing two thing creating a hypermedia representation of the content and thus we need to understand **how to handle multiumedia content types and the content**.

> So the question is if an agent goes back to a fragment, we have a description and we have the fragment.Is that enough context to then infer how to permission things simply  by clicking, selecting, or describing what to share and generating a link we can issue.

Actually I think I understand why It's important to be able to search for networks you can join. I think the share api can enable some of this.

### Scenario: Joining a network via wifi
I connect to a wifi network there's a local site for this wifi network

It ask me to login or join as  a guest. It also generates a share link I use to open onBraid and connect to the network. I can broadcast content. I can also search for content and visualize it in my app. 

### Scenario: Joining via link sent via a messenger or email
It ask me to login or join as  a guest. I share the connector with onbraid.app. I can broadcast content if my permission allow it. I can also search for content and render it in my app if my permissions allow it.


### Scenario: Sharing module(s)
I open a module and decide I want to share a module with one or many people the act of doing so creates a network? Or am I simply adding urls to my CSP for who's allowed to display content on their client I think it's the later. 




I want to join  a network



So when we say ask we telling onBraid to ask us which information we want to share ina fragment. This generates a new routes with the correct CSP policy for the clients able to view that.


---
## Techinical 

Alright so we want to create bundles and have routes for our modules like normal html pages.

A module in it's default state is totally private only accessible by our author

So when we ask an author if they want to share all or portion of a module we are asking to apply conditional logic to how the template is rendered. Maybe not we can't really detect who and what with referrer domain most likely. So how about we just go the brute force way. We generate a unique route based on what the boundary allows.

so if we created files based in each this might not be horrible but we also be have a lot of clean up though that might be true for another path. So maybe we could generate a a default module . I think we want to use basic PAT for a route. 

Okay so no iframe directly is probably a failed approach as we need to pass a PAT of some sort when we fetch.

```ts
import { MyFragment } from './my-fragment'



```

I'm not quite sure about this

- Give permission to access fragment(s) on your site
- Give permission to iframe fragment(s) on another site
- Get permission to iframe a fragment(s) from another site
- Get permission to view  fragment(s) on another site
- Share fragments public

So how would this work with the client < - > communication? Well you'd either need to open an iframe which means external domain would need to allow CORS. The other option is opening a new window/tab. We can't use popup not enough cross browser utility. So let's aay we do that well technically you'd need to have the tab to the other client open for as long as you need. HMM yeah that's a no go. honestly it's sorta gross. So if someone is using this then I think the simplest way to do this is to simply create a a route.


