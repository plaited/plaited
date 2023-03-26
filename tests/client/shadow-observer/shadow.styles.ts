import { css } from '$plaited'
import { opacityHex } from '$utils'
export const { styles, classes } = css`
.zone {
  border: 1px black dashed;
  margin: 24px;
  padding: 12px;
  height: 300px;
  display: flex;
  flex-direction: column;
  gap: 25px;
  position: relative;
}
.svg {
  width: 125px;
  height: 125px;
}
.sub-island {
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000000${opacityHex().get(0.75)};
  color: #ffffff${opacityHex().get(0.80)}
}
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
