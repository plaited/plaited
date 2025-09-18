import { getHTMLResponses } from './get-html-responses.js'
import { getEntryResponses } from './get-entry-responses.js'

export const getRoutes = async (cwd: string, entrypoints: string[]) => {
  const rotues = {
    ...(await getEntryResponses(cwd, entrypoints)),
  }
  await Promise.all(
    entrypoints.map(async (entry) => {
      const filePath = entry.replace(new RegExp(`^${cwd}`), '')
      const routes = await getHTMLResponses(filePath)
      Object.assign(rotues, ...routes)
    }),
  )
  return rotues
}
