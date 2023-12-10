type StylesheetsProps = Array<string | undefined | false | null>
/** takes an array of conditional stylesheet objects and returns a stylesheet
 * object with each individual sheet in an array  */
export const stylesheets = (...sheets: StylesheetsProps) => sheets.filter(Boolean) as string[]
