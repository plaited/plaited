type Primitive = number |
  string |
  boolean |
  undefined |
  null |
  void 

const css = (strings: TemplateStringsArray, ...values: Array<Primitive | Primitive[]>) => {
  return { styles: {
    button: 'bbbbb',
  },
  sheet: String.raw({ raw: strings }, ...values),
  }
}

export const { sheet, styles } = css`
.Button {

}
`
