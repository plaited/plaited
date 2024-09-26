import * as esbuild from 'esbuild';

const result = esbuild.build({
  entryPoints: [ { 'src/workshop/use-workshop.ts': 'use-workshop' }],
})
