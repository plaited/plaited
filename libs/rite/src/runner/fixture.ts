import { test as base, Page } from '@playwright/test';
import { StoryObj } from './types.js';
import { BuildArtifact } from 'bun';

const content = ({bundle, story, tpl}: { bundle: BuildArtifact, story: string, tpl: string}) => `
${tpl}
<script type="module">
${bundle}
const defineRegistry = (registry, silent = false) => {
  for (const el of registry) {
    if (customElements.get(el.tag)) {
      !silent && console.error(\`\${el.tag} already defined\`)
      continue
    }
    customElements.define(el.tag, el())
  }
}
${story}?.render && defineRegistry(${story}.render(${story}?.attrs || {}))
${story}?.play && ${story}?.play()
</script>
`

class StoryPage {
  #page: Page;
  constructor(readonly page: Page) {}

  async goto(story: { path, story: StoryObj, name: string }) {
    const bundle = await bundle({ entrypoint: story.path });
    const { render, options, play, attrs } = story
    const tpl = render && render({...attrs })
  }
}

export const test = base.extend<MyFixtures>({
  getStory: async ({ page }, use) => {
    // Set up the fixture.
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo('item1');
    await todoPage.addToDo('item2');

    // Use the fixture value in the test.
    await use(todoPage);

    // Clean up the fixture.
    await todoPage.removeAll();
  },

});
export { expect } from '@playwright/test';