import * as path from 'node:path';
import { PlaitedTemplate } from 'plaited'
import { camelCase } from '@plaited/utils'

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

const sourceModules: Map<string, string> = new Map()

export const ssr = (template: PlaitedTemplate, url: string) => {
  const name = capitalize(camelCase(template.tag))
  if(sourceModules.has(name)) {
    console.error(`Module ${name} already registered\nurl: ${url}`)
    return
  }
  sourceModules.set(capitalize(camelCase(template.tag)), url)
  return template
}


const  stripCommonStart = (files: Map<string, string>): Map<string, string> => {
  // Split each file path into parts
  const splitFiles = [...files].map(([name, url]): [string, string[]] => [name, path.resolve(url.replace(/\.(t|j)s(x)?$/, '.js')).split(path.sep)]);

  // Find the shortest file path
  const shortest = Math.min(...splitFiles.map(([_, parts]) => parts.length));

  // Find the common parts
  const commonParts = [];
  for (let i = 0; i < shortest; i++) {
    const [_, part] = splitFiles[0][i];
    if (splitFiles.every(([_, parts]) => parts[i] === part)) {
      commonParts.push(part);
    } else {
      break;
    }
  }

  // Strip the common parts from each file path
  const strippedFiles = splitFiles.map(([name, parts]):[string, string] => [name, parts.slice(commonParts.length).join(path.sep)]);

  return new Map(strippedFiles);
}


export const getRegisteredModules = () => stripCommonStart(sourceModules)


const bundleModules = async () => {
  const entrypoints = [...sourceModules.values()]
  
  const result = await Bun.build({
    entrypoints,
    minify: true,
    splitting: true,
    sourcemap: 'external',
    outdir: 'modules'
  })
  return result.outputs
}