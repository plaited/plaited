import { workshop } from '../workshop.js'

const server = await workshop({
  exts: '.stories.tsx',
  srcDir: 'src/tests/__mocks__/get-story-valid',
  testDir: '.playwright',
  reload: true,
})

server.start()
