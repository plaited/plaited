export const useStyle = (style: Record<string, string | number>) =>
  Object.entries(style)
    .map<string>(([prop, val]) => `${prop}:${val};`)
    .join(' ')
