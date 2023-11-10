type StylesheetsProps = Array<{ stylesheet: string } | undefined | false | null>
/** takes an array of conditional stylesheet objects and returns a stylesheet
 * object with each individual sheet in an array  */
export const stylesheets = (...sheets: StylesheetsProps) => {
  const toRet: { stylesheet: string[] } = { stylesheet: [] }
  for (const sheet of sheets) {
    if (sheet) {
      toRet.stylesheet.push(sheet.stylesheet)
    }
  }
  return toRet
}
