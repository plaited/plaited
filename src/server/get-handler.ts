import { Routes, Handler, ErrorHandler, UnknownMethodHandler, ReloadClient } from './types.ts'
import { getReloadRoute } from './get-reload-route.ts'
import { rutt } from '../deps.ts'

export const getHandler = ({
  routes,
  reload,
  reloadClients,
  otherHandler,
  errorHandler,
  unknownMethodHandler,
}:{
  routes:Routes
  reload: boolean
  reloadClients: ReloadClient[]
  otherHandler?: Handler
  errorHandler?: ErrorHandler
  unknownMethodHandler?: UnknownMethodHandler
}) => {  
  return rutt.router(
    {
      ...routes,
      ...getReloadRoute(reload, reloadClients),
    },
    otherHandler,
    errorHandler,
    unknownMethodHandler
  )
}