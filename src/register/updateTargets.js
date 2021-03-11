import {dataIsland, dataTarget} from '../constants'
export const updateTargets = context => {
  const targets = [...(context.querySelectorAll(`[${dataTarget}]`))]
    .filter(el => el.closest(`[${dataIsland}]`) === context)
    .reduce((acc, el) => {
      const key = el.dataset.target.trim()
      !acc.has(key)
        ? acc.set(key, el)
        : !Array.isArray(acc.get(key)) 
        ? acc.set(key, [acc.get(key), el])
        : acc.get(key).push(el)
      return acc
    }, new Map())
  context.targets = targets
}
