import { css } from '$plaited'
export const { styles, classes } = css`
:host {

}
.shell {
  width: 100%;
  height: 100vh;
  display: grid;
  gap: 18px;
  grid-template-columns:300px 1fr;
  padding: 16px;
 box-sizing: border-box;
}
.nav{
  height: 100%;
  border-radius: 8px;
}

.main {
  justify-self: stretch;
  height: 100%;
  overflow: auto;
  border-radius: 8px;
  display: flex;
  flex-direction: row;
  align-items: stretch;
}
.item {
 color: rebeccapurple;
  border-radius: 8px;
  height: 32px;
  display: block;
}
.item:hover {
 color: blue;
}
.nav-button {
   all: unset;
   width: 100%;
   height: 100%;
   font-weight:700;
   line-height: 1.5;
   font-size: 18px;
   display: block;
   word-break: break-all;
}
.test-frame {
  display: block;
  width: 100%;
  overflow: hidden;
}
`
