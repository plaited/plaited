# Hybrid Hypermedia components

## Attributes

### Current
- bp-trigger: right now this takes an object of trigger user event and feedback action pairs
- bp-target: right now attaching this to a element is how we query this element
- bp-address: right now this is used for a plaited component so we can connect it to a messenger.

### Proposed
- bp-sse: connect to sse server sent event
- bp-ws: connect to websocket, send to web socket
- bp-hypermedia: sets up component to use hypermedia

I don't think we want to manually manage history api rather just wuto do it like Hotwire's turbo

Basically if the component has the bp-hypermedia attribute we intercept and form and links submissions

- bp-trigger, update to support once via a [once] thing
- bp-trigger, consider delay and 

Think I want to add a $.merge that looks to see if elements have the same ids and merges attributes and replaces interior content.

We could introduce a navigate helper for navating to a new page via fetch utility

We could also have a submit one for submit form data and and using the rsponse for doing whatever we ant to. 

Okay yeah we need to handle naviagte in intercept for links. Also need to figure out how ti make the small head update possible.
Think we'll have to pull in a fast dom diff just for the head I'm not screwing with that.

As for the body we just replace it on links

Now that leaves us with just form submission

---

Now let's rethink this We can capture link clicks at the body and simply handle rerouting that way. So a Component does not have to be aware of that.

So what about form submission? We can ahave an event listner

Alright we're going to stop propogation of link clicks at this at the global level not the CE level.