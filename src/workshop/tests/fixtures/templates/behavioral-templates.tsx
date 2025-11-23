import { bElement } from '../../../../main.ts'

export const SimpleBehavioralTemplate = bElement({
  tag: 'simple-component',
  shadowDom: <div>Simple Component</div>,
})

export const BehavioralTemplateWithProgram = bElement({
  tag: 'interactive-component',
  shadowDom: (
    <button
      type='button'
      p-target='btn'
    >
      Click me
    </button>
  ),
  bProgram({ $ }) {
    const [btn] = $('btn')
    return {
      CLICK() {
        btn.render('Clicked!')
      },
    }
  },
})
