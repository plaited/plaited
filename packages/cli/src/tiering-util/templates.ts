export const reExportTemplate = (component: string, packageName:string) => `export * from '${packageName}/src/${component}'`
export const ejectTemplate = (component: string) => `export * from './${component}'`

