import type {  BunPlugin } from "bun";
import { db } from "./db.js";

export const plugin: BunPlugin = {
  name: "Plaited loader",
  setup(build) {
    build.onResolve({ filter: /\/route.tsx?$/ }, async ({ path }) => {
      // mark external all non-template files
    })
    build.onLoad({ filter: /\/route.tsx?$/ }, async ({ path }) => {
      // modify the contents of the file to be an export object.
      return {
        contents,
        loader: "tsx",
      };
    });
  },
}