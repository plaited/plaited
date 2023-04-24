We need a client side router that basically hides in the background.

We want to intercept all link clicks for the current domain and handle them
differently.

Also let's say we have a client side url. When we do certain actions we are
setting query parameters for the current page. or for the page we're redirecting
to within the current domain.Those same query parameters can be hit coming to
the page fresh if pasted into the tab of a new session.

So aren't I essentially just saying new Request baswed on submission of a
button. and the new request is updating the url and fetching the requiste data.

So then the question becomes this if the new request is for data we already have
and transformations we can do on the client side do we really need to go tot he
server for it? How can we tell.? The answer is the client side rout which has a
callback function that controls hjow we respond it's it's own sort of
middleware.

We can control wether is goes back to the server or if it uses cached data from
the first time the request came through.
