import { getOpacityHex } from './get-opacity-hex.js'

export const parseToRgb = (hex: string) =>{
  if(!hex.startsWith('#'))  return
  const sixDigits = `${parseInt(`${hex[1]}${hex[2]}`, 16)},${parseInt(
    `${hex[3]}${hex[4]}`,
    16
  )},${parseInt(`${hex[5]}${hex[6]}`, 16)}` 
  if(hex.length === 7) {
    return `rgb(${sixDigits})`
  }
  if(hex.length === 9) {
    const value = [ ...getOpacityHex() ].find(([ , last2 ]) => last2 === hex.slice(7,9))
    return value ? `rgba(${sixDigits},${value[0]})` : undefined
  }
}
  
