import { Actions, Strands, strand, loop, request, waitFor, useStore } from '@plaited/island'

interface Combobox {
  (args: {
    uid: string,
    mode: 'open' | 'closed'
    autocomplete?: boolean
    editable?: boolean
  }): {
    actions: Actions, strands: Strands, template: string
  }
}

export const combobox: Combobox = ({
  uid,
  mode = 'closed',
  autocomplete = false,
  editable = true,
}) => {
  const [ getMode, setMode ] = useStore<'open' | 'closed'>(mode) 
  /* Combobox Keyboard Interaction */
  const comboboxStrands: Strands = {
    arrowDownAutocomplete: loop(strand(
      waitFor({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'ArrowDown' &&
          getMode() === 'open' &&
          autocomplete === true
        ), 
      })
    )),
    arrowDown: loop(strand(
      waitFor({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'ArrowDown' &&
          getMode() === 'open' &&
          autocomplete === false
        ), 
      })
    )),
    arrowUp: loop(strand(
      waitFor({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'ArrowUp' &&
          getMode() === 'open'
        ), 
      })
    )),
    escapeOpen: loop(strand(
      waitFor({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'Escape' &&
          getMode() === 'open'
        ), 
      })
    )),
    escapeClosed: loop(strand(
      waitFor({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'Escape' &&
          getMode() === 'closed'
        ), 
      })
    )),
    enterEditable: loop(strand(
      waitFor({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'ArrowUp' &&
          getMode() === 'open' &&
          editable === true
        ), 
      })
    )),
    enterNotEditable: loop(strand(
      waitFor({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'Enter' &&
          getMode() === 'open' &&
          editable === false
        ), 
      })
    )),
    altArrowDown: loop(strand(
      waitFor({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'ArrowDown' &&
          getMode() === 'closed' &&
          payload.altKey === true
        ), 
      })
    )),
    altArrowUp: loop(strand(
      waitFor({
        eventName: `keydown->${uid}`, 
        callback: ({ payload }: { payload: KeyboardEvent}) => (
          payload.key === 'ArrowUp' &&
          getMode() === 'open' &&
          payload.altKey === true
        ), 
      })
    )),
    
  }
  const actions: Actions = ({ $, root }) => ({

  })


  return { actions, strands: {}, template: '' }
} 
