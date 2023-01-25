import path from 'path'
import fs from 'fs/promises'

export const writeRoutes = async (
  routesDir: string,
  flattenedWorks:[string, {
  route: () => string;
  title: string;
  name: string;
}][]) => {
  const routes: Record<string, () => string> = {}
  for(const work of flattenedWorks) {
    const [ key, obj ] =  work
    routes[key] = obj.route
  }
  const content = `export const routes = ${JSON.stringify(routes, null, 2)}`
  fs.mkdir(routesDir, { recursive: true })
  fs.writeFile(path.resolve(routesDir, 'routes.ts'), content)
}
