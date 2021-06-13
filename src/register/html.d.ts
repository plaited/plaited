type PrimitiveFalsey = number |
  string |
  boolean |
  undefined |
  null |
  void
type HtmlArgs = Array<PrimitiveFalsey | PrimitiveFalsey[]>
export function html(strings: TemplateStringsArray, ...expressions: HtmlArgs): string
