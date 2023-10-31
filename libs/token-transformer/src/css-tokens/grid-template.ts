import { GridMinMaxArgs, GridTemplateValue, GridTemplateToken, GridTemplateAreasValue } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getRem } from '../utils.js'

const getFitContent = ({
  func,
  value,
  baseFontSize,
  acc = '',
}: {
  func: string
  value: number | `${number}%`
  baseFontSize: number
  acc?: string
}) => acc + ` ${func}(${typeof value === 'string' ? value : getRem(value, baseFontSize)})`

const getMinMax = ({
  func,
  acc = '',
  baseFontSize,
  min,
  max,
}: {
  func: string
  baseFontSize: number
  acc?: string
  min: GridMinMaxArgs
  max: GridMinMaxArgs
}) =>
  acc +
  ` ${func}(${typeof min === 'number' ? getRem(min, baseFontSize) : min}, ${
    typeof max === 'number' ? getRem(max, baseFontSize) : max
  })`

const isTemplateAreaValues = ($value: GridTemplateValue): $value is GridTemplateAreasValue =>
  typeof $value[0] === 'string' && /"(\w*)"/.test($value[0])

const gridTemplateCallback = (baseFontSize: number) => ($value: GridTemplateValue) => {
  if (isTemplateAreaValues($value)) {
    return $value.join(' ')
  }
  return $value.reduce<string>((acc, cur) => {
    if (typeof cur === 'number') {
      return acc + ` ${getRem(cur, baseFontSize)}`
    }
    if (typeof cur === 'string') {
      return acc + ` ${cur}`
    }
    if (cur.function === 'fit-content') {
      getFitContent({
        acc,
        baseFontSize,
        func: cur.function,
        value: cur.value,
      })
    }
    if (cur.function === 'minmax') {
      getMinMax({
        acc,
        baseFontSize,
        func: cur.function,
        min: cur.range[0],
        max: cur.range[1],
      })
    }
    if (cur.function === 'repeat') {
      const func = cur.function
      const tracks: string = cur.tracks
        .map((val) => {
          if (typeof val === 'number') {
            return ` ${getRem(val, baseFontSize)}`
          }
          if (typeof val === 'string') {
            return ` ${val}`
          }
          if (val.function === 'fit-content') {
            return getFitContent({
              baseFontSize,
              func: val.function,
              value: val.value,
            })
          }
          if (val.function === 'minmax') {
            return getMinMax({
              baseFontSize,
              func: val.function,
              min: val.range[0],
              max: val.range[1],
            })
          }
        })
        .join(' ')
      return acc + ` ${func}(${tracks.trim()})`
    }
    return acc
  }, '')
}

export const gridTemplate: Formatter<GridTemplateToken> = (
  token,
  { allTokens, tokenPath, baseFontSize, ...contexts },
) => {
  const cb = gridTemplateCallback(baseFontSize)
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken<GridTemplateToken, GridTemplateValue>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    return getRule({ prop, value: cb($value) })
  }
  const toRet: string[] = []
  if (isContextualToken<GridTemplateToken, GridTemplateValue>(token)) {
    const {
      $value,
      $extensions: { 'plaited-context': $context },
    } = token
    for (const id in $value) {
      const contextValue = $value[id]
      if (hasAlias(contextValue)) {
        toRet.push(getRule({ prop, value: resolveCSSVar(contextValue, allTokens) }))
        continue
      }
      const context = { type: $context, id }
      if (isValidContext({ context, ...contexts })) {
        toRet.push(getRule({ prop, value: cb(contextValue), context, ...contexts }))
      }
    }
  }
  return toRet.join('\n')
}
