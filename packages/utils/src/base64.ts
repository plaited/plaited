export const base64 = (str: string) => typeof btoa === 'undefined'
  ? Buffer.from(str.toString()).toString('base64')
  : btoa(str)
