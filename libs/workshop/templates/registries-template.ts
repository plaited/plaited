export const registriesTemplate = (registries: string[]) =>
  `${
    registries.map((path) => {
      return `<script type="module" src="/${path}" async></script>`
    }).join('\n')
  }`
