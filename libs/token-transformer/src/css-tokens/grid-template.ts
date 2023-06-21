import {
  Formatter,
  GridMinMaxArgs,
  GridTemplateRowsOrColumnsValue,
  GridTemplateValue,
} from '@plaited/token-types'
import { hasAlias } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { getRem } from '../get-rem.js'

const getFitContent = ({
  func,
  value,
  baseFontSize,
  acc = '',
}: {
  func: string;
  value: number | `${number}%`;
  baseFontSize: number;
  acc?: string;
}) =>
  acc +
  ` ${func}(${
    typeof value === 'string' ? value : getRem(value, baseFontSize)
  })`

const getMinMax = ({
  func,
  acc = '',
  baseFontSize,
  min,
  max,
}: {
  func: string;
  baseFontSize: number;
  acc?: string;
  min: GridMinMaxArgs;
  max: GridMinMaxArgs;
}) =>
  acc +
  ` ${func}(${typeof min === 'number' ? getRem(min, baseFontSize) : min}, ${
    typeof max === 'number' ? getRem(max, baseFontSize) : max
  })`

export const gridTemplate: Formatter<GridTemplateValue> = (
  { tokenPath, $value, baseFontSize }
) => {
  if (hasAlias($value)) return ''
  if (typeof $value[0] === 'string' && /"(\w*)"/.test($value[0])) {
    return `:root { --${kebabCase(tokenPath.join(' '))}: ${
      $value.join(' ')
    }; }`
  }
  const _value = ($value as GridTemplateRowsOrColumnsValue)
    .reduce<string>((acc, cur) => {
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
        const tracks: string = cur.tracks.map(val => {
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
        }).join(' ')
        return acc + ` ${func}(${tracks.trim()})`
      }
      return acc
    }, '')
  return `:root { --${kebabCase(tokenPath.join(' '))}: ${_value}; }`
}
