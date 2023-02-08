import { GetHandler } from './types.ts'
import { getReloadRoute } from './get-reload-route.ts'
import { rutt } from '../deps.ts'

export const getHandler: GetHandler = ({
  routes,
  reload,
  reloadClients,
  otherHandler,
  errorHandler,
  unknownMethodHandler,
}) => {
  return rutt.router(
    {
      ...routes,
      ...reload ? getReloadRoute(reloadClients) : {},
    },
    otherHandler,
    errorHandler,
    unknownMethodHandler,
  )
}
