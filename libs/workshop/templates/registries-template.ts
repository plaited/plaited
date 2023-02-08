export const registriesTemplate = (registries: string[]) =>
  `${
    registries.map((path) => {
      return `<script type="module" src="/${path}"></script>`
    }).join('\n')
  }`
