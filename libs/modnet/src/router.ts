import path from 'node:path'

export const getRouter = (dir: string) => {
  const router = new Bun.FileSystemRouter({
    style: 'nextjs',
    dir,
    fileExtensions: ['.tsx', '.ts'],
  })

  const publicRoutes = new Map<string, string>()
  const getPublicRoutes = () => {
    publicRoutes.size && publicRoutes.clear()
    for (const route in router.routes) {
      const filePath = router.routes[route]
      if (
        !path
          .dirname(filePath)
          .split(path.sep)
          .some((part) => part.startsWith('_'))
      ) {
        publicRoutes.set(route, filePath)
      }
    }
    return publicRoutes
  }

  return { router, getPublicRoutes }
}
