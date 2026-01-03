import { bElement } from 'plaited'

export const NoFocusDelegation = bElement({
  tag: 'no-focus-delegation',
  delegatesFocus: false,
  shadowDom: <span>mode open and delegates focus</span>,
})

export const OpenShadow = bElement({
  tag: 'open-shadow',
  shadowDom: <span>mode open and delegates focus</span>,
})

export const ClosedShadow = bElement({
  tag: 'closed-shadow',
  mode: 'closed',
  shadowDom: <span>mode open and delegates focus</span>,
})
