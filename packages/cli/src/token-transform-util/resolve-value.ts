const hasResolvedValue = ({ path, set }) => {
  let obj = set
  for (let i = 0, len = path.length; i < len; i++) {
    if (!obj[path[i]]) {
      return false
    }
    if (i + 1 === len && obj[path[i]].hasOwnProperty('$value')) {
      return true
    }
    obj = obj[path[i]]
  }
  return false
}

const resolve = ({
  deps,
  sourceTokens,
  path,
  tpl,
  transformed,
  prefix,
}) => {
  const prefixedPath = [ prefix, ...path ].filter(Boolean)
  if (hasResolvedValue({ path, set: transformed })) {
    return tpl(prefixedPath)
  }
  for (const key in sourceTokens) {
    if (hasResolvedValue({ path, set: sourceTokens[key] })) {
      deps && deps.get(key).push(prefixedPath)
      return tpl(prefixedPath)
    }
  }
}



const onlyReferencesSelf = (rawValue, transformed) => {
  const paths = [ ...rawValue.matchAll(/(?:\{)([^"]*?)(?:\})|(?:\$)([a-zA-Z][a-zA-Z0-9.-]+)/g) ].map(([ , path ]) => {
    return path.split('.')
  })
  for (const path of paths) {
    if (!hasResolvedValue({ path, set: transformed })) {
      return false
    }
  }
  return true
}

const resolveValue = ({
  deps,
  sourceTokens,
  rawValue,
  tpl,
  transformed,
  prefix,
}) => {
  return rawValue.replace(/(?:\{)([^"]*?)(?:\})|(?:\$)([a-zA-Z][a-zA-Z0-9.-]+)/g, (_, p1, p2) => resolve({
    deps,
    sourceTokens,
    path: (p1 || p2).split('.'),
    tpl,
    transformed,
    prefix,
  }))
}

const usesAlias = str => {
  const regex = /(?:\{)([^"]*?)(?:\})|(?:\$)([a-zA-Z][a-zA-Z0-9.-]+)/g
  return regex.test(str)
}

const isComposite = str => {
  const regex1 = /(?:\{)([^"]*?)(?:\})|(?:\$)([a-zA-Z][a-zA-Z0-9.-]+)/g
  if (str.match(regex1).length > 1) return true
  const regex2 = /^(?:\{)([^"]*?)(?:\})|(?:\$)([a-zA-Z][a-zA-Z0-9.-]+)/g
  if(!regex2.test(str)) return true
}

exports.onlyReferencesSelf = onlyReferencesSelf
exports.resolveValue = resolveValue
exports.usesAlias = usesAlias
exports.hasValue = hasValue
exports.isComposite = isComposite
