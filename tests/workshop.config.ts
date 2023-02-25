import { WorkshopConfig } from '$plaited'
export default {
  assets: './.workshop',
  dev: true,
  exts: {
    story: '.stories.ts',
    worker: '.worker.ts',
    island: '.islands.ts',
  },
  importMap: '../.vscode/import-map.json',
  port: 3000,
  workspace: './stories',
} as WorkshopConfig
