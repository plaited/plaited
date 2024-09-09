/**
 * (c) Robert Soriano - MIT
 * {@see https://github.com/wobsoriano/bun-plugin-virtual}
 */

type VirtualModuleOptions = Record<string, string | Record<string, unknown>>;

const moduleMap = new Map<string, string>()

export function virtualModule(options: VirtualModuleOptions): import('bun').BunPlugin {
  const namespace = 'virtual';

  const filter = new RegExp(
    Object.keys(options).map((name) => `^${name}$`).join("|"),
  );

  generateModuleMap(options);

  return {
    name: 'bun-plugin-virtual',
    setup({ onResolve, onLoad }) {
      onResolve({ filter }, (args) => ({ path: args.path, namespace }));

      onLoad(
        { filter: /.*/, namespace },
        (args) => {
          const contents = moduleMap.get(args.path);

          if (!contents) {
            throw new Error(`Could not find virtual module ${args.path}`);
          }

          return { contents, loader: 'js' }
        },
      );
    }
  }
}

function generateNamedExports(obj: Record<string, unknown>) {
  const exportStrings = [];

  for (const key in obj) {
    exportStrings.push(`export const ${key} = ${JSON.stringify(obj[key])};`);
  }

  return exportStrings.join('\n');
}

function generateModuleMap(options: VirtualModuleOptions) {
  for (const key in options) {
    const contents = options[key];
    if (typeof contents === 'string') {
      moduleMap.set(key, contents);
    } else {
      moduleMap.set(key, generateNamedExports(contents));
    }
  }
}