export const useTrigger = (triggers: Record<string, string>) =>
  Object.entries(triggers)
    .map<string>(([ev, req]) => `${ev}->${req}`)
    .join(' ')
