import type {  PromptEntry, UsePrompt,  ResourceEntry, UseResource, ToolEntry, UseTool } from "./mcp.types"

export const usePrompt:UsePrompt = ({title, description, argsSchema, handler }) => {
  const entry: PromptEntry = {
    primitive: "prompt",
    config: {
      title,
      description,
      argsSchema,
    },
  }
  return { entry, handler }
}

export const useResource: UseResource = ({metaData, uriOrTemplate, handler }) => {
  const entry: ResourceEntry = {
    primitive: "resource",
    config: {
      metaData,
      uriOrTemplate
    },
  }
  return { entry, handler}
}

export const useTool: UseTool = ({title, description, inputSchema, outputSchema, annotations, handler }) => {
  const entry: ToolEntry = {
    primitive: "tool",
    config: {
     title,
     description,
     inputSchema,
     outputSchema,
     annotations
    },
  }
  return { entry, handler}
}