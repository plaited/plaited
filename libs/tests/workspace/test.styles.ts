import { css } from '$plaited'
export const { styles, classes } = css`
.row {
  display: flex;
  gap: 10px;
  padding: 12px;
}
::slotted(button), .button {
  height: 18px;
  width: auto;
}
`
