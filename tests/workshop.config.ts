import { WorkshopConfig } from '$plaited'
export default {
  assets: './.workshop',
  colorScheme: true,
  dev: true,
  exts: {
    story: '.stories.ts',
    worker: '.worker.ts',
    island: '.island.ts',
  },
  importMap: '../.vscode/import-map.json',
  port: 3000,
  playwright: './playwright',
  workspace: './stories',
} as WorkshopConfig
