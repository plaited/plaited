import {trueTypeOf} from '@plaited/utils'
import {svgTags} from './constants'

const setStyles = (node, style) => {
  for (const rule in style) {
    node.style[rule] = style[rule]
  }
}

const applyAttribute = (node, key, value) => {
  const svg = svgTags.has(node.tagName)
  switch(key) {
    case 'className': {
      svg
        ? node.setAttribute('class', value)
        : (node.className = value)
      break
    }
    case 'htmlFor': {
      !svg && (node.htmlFor = value)
      break
    }
    case 'style': {
      setStyles(node, value)
      break
    }
    default: {
      node.setAttribute(key, value)
    }
  }
}

const setAttribute = (nodeList, key, value) => 
  nodeList.forEach(node => applyAttribute(node, key, value))
const getAttribute = (nodeList, key) =>
  nodeList.map(node => node.getAttribute(key))
const removeAttribute = (nodeList, key) =>
  nodeList.forEach(node => node.removeAttribute(key))

const updateMultipleAttributes = (nodeList, attrs) =>
  nodeList.forEach(node => {
    for(const key in attrs) {
      applyAttribute(node, key, attrs[key])
    }
  })

export const attr = nodeList => (key, value) =>
  trueTypeOf(key) === 'object'
    ? updateMultipleAttributes(nodeList, key)
    : value === null
    ? removeAttribute(nodeList, key)
    : value === undefined
    ? getAttribute(nodeList, key)
    : setAttribute(nodeList, key, value)
