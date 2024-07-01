import { sep, resolve, dirname } from 'node:path';

import { PlaitedTemplate } from '../types.js'
import { isTypeOf } from '@plaited/utils'
import { PLAITED_COMPONENT_IDENTIFIER } from '../shared/constants.js'
import { componentMap } from './constants.js'

const isPlaitedComponent = (mod: unknown): mod is PlaitedTemplate =>
  isTypeOf<{
    (...args: unknown[]): unknown
    [key: string]: unknown
  }>(mod, 'function') && mod?.$ === PLAITED_COMPONENT_IDENTIFIER

export const findComponentImports = async (filePath: string) => {
  try {
    const transpiler = new Bun.Transpiler({
      loader: 'tsx',
    });
    const importPaths = transpiler
      .scanImports(filePath)
      .flatMap(({path}) => path.split(sep).includes('_components') ?
        [resolve(dirname(filePath), path)] :
        []
      );
    componentMap.clear()
    const entries = await Promise.all(
      importPaths.map(async (path) => {
        try {
          const modules = await import(path)
          for (const name of modules) {
            const mod = modules[name]
            if (!mod || !isPlaitedComponent(mod)) continue
            if (componentMap.has(mod.tag))
              return console.error(
                `Duplicate module found for: ${mod.tag}\n${JSON.stringify(
                  {
                    current: path,
                    previous: componentMap.get(mod.tag),
                  },
                  null,
                  2,
                )}`,
              )
            componentMap.set(mod.tag, { path: `/${path.replace(/\.tsx$/, '.js')}`, name })
          }
          return path
        } catch (err) {
          console.error(err)
        }
      }),
    )
    // Step 5: Return the list of import paths that have PlaitedComponents
    return entries.filter(Boolean);
  } catch (error) {
    console.error('Error reading file:', error);
    return [];
  }
}