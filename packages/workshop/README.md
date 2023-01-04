# @plaited/workshop
A simple live preview workshop for developing plaited ui components. It leverages the [Component Story Format](https://github.com/ComponentDriven/csf)

## Features
1. Visual Regression test codegen does not overwrite already written test
2. Accessibility tests codegen using a11y parameters config on stories that adhere to deques config
3. Server side rendering of stories
4. Somehow combine live preview with https://playwright.dev/docs/debug such that in your story you might have a play function on the story that uses the playwright test utils to assert on the dom and use https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright#run-tests-with-a-single-click to navigate your stories I think