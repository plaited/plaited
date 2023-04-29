import { GetRouteHandler } from "./types.js";
import { getReloadRoute } from "./get-reload-route.js";
import { router } from "./router.js";

export const getRouteHandler: GetRouteHandler = ({
  routes,
  reload,
  reloadClients,
  otherHandler,
  errorHandler,
  unknownMethodHandler,
}) => {
  reload && routes.set(...getReloadRoute(reloadClients));
  return router(routes, { otherHandler, errorHandler, unknownMethodHandler });
};
