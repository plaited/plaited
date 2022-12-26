import { Actions, Strands, strand, loop, request, waitFor, useStore } from '@plaited/island'

interface Select {
  (args: {
    uid: string,
    mode: 'open' | 'closed'
    autocomplete?: boolean
    editable?: boolean
  }): {
    actions: Actions, strands: Strands, template: string
  }
}


export const select: Select = ({
  uid,
}) => {
  const strands: Strands  = {
    arrowDown: loop(strand(
      request({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'ArrowDown'
        ), 
      })
    )),
    altArrowDown: loop(strand(
      request({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'ArrowDown' &&
          payload.altKey === true
        ), 
      })
    )),
    arrowUp: loop(strand(
      request({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'ArrowUp'
        ), 
      })
    )),
    altArrowUp: loop(strand(
      request({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'ArrowUp' &&
          payload.altKey === true
        ), 
      })
    )),
    escape: loop(strand(
      request({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'Escape'
        ), 
      })
    )),
    end: loop(strand(
      request({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'End'
        ), 
      })
    )),
    enter: loop(strand(
      request({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'Enter'
        ), 
      })
    )),
    home: loop(strand(
      request({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'Home'
        ), 
      })
    )),
    pageUp: loop(strand(
      request({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'PageUp'
        ), 
      })
    )),
    pageDown: loop(strand(
      request({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'PageDown'
        ), 
      })
    )),
    space: loop(strand(
      request({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === ' '
        ), 
      })
    )),
    tab: loop(strand(
      request({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'Tab'
        ), 
      })
    )),
    printableChar: loop(strand(
      waitFor({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key.length === 1
        ), 
      })
    )),
  }

  const actions: Actions = ({ $, root }) => ({

  })


  return { actions, strands: {}, template: '' }
}
