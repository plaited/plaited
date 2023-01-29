# Workshop util

Okay so what does this thing need to do. Well we create works similar to stories in storybook.  Those works are server rendered to reflect actual usage in production. We also use the same modules we used to render those works to generate client side javascript assets that are necessary in order for our plaited library to enable dom manipulations and client side logic.

So we are generate starter test files
We are generating client side assets for rendering
We should also be cleaning up test if we delete a work
We should also be be cleaning up the entire assets directory whenever we spin up the workshop so we are working with a clean slate. We may introducing a caching strategy later but not right now.
We should generate the site local to the workshop package or in this case the cli package.
