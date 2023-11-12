import { css } from '@plaited/jsx'
import { test } from '@plaited/rite'
import { Component, PlaitProps } from '../index.js'

test('eventTriggers', async (t) => {
  const [classes, stylesheet] = css`
    .row {
      display: flex;
      gap: 10px;
      padding: 12px;
    }
    .button {
      height: 18px;
      width: auto;
    }
  `
  const wrapper = document.querySelector('body')

  class Bottom extends Component({
    tag: 'bottom-component',
    template: (
      <button
        dataTarget='button'
        className={classes.button}
        dataTrigger={{ click: 'click' }}
      >
        Add
      </button>
    ),
  }) {
    static observedTriggers = new Set(['add'])
    plait({ feedback, emit }: PlaitProps) {
      feedback({
        click() {
          emit({ type: 'append' })
        },
      })
    }
  }

  class Top extends Component({
    tag: 'top-component',
    dev: true,
    template: (
      <div
        className={classes.row}
        {...stylesheet}
      >
        <h1
          dataTarget='header'
          {...stylesheet}
        >
          Hello
        </h1>
        <Bottom.tag
          dataTarget='header'
          data-trigger={{ append: 'append' }}
        ></Bottom.tag>
      </div>
    ),
  }) {
    plait({ feedback, $ }: PlaitProps) {
      feedback({
        append() {
          const header = $('header')
          header.render({ content: ' World!', stylesheets: new Set() }, 'beforeend')
        },
      })
    }
  }

  // Create elements and append to dom
  const top = document.createElement(Top.tag)
  wrapper.insertAdjacentElement('beforeend', top)

  // // Define elements
  customElements.define(Top.tag, Top)
  customElements.define(Bottom.tag, Bottom)

  const button = await t.findByAttribute('data-target', 'button', wrapper)
  const header = await t.findByAttribute('data-target', 'header', wrapper)
  t({
    given: 'render',
    should: 'header should contain string',
    actual: header?.textContent,
    expected: 'Hello',
  })
  button && (await t.fireEvent(button, 'click'))
  t({
    given: 'clicking button',
    should: 'append string to header',
    actual: header?.textContent,
    expected: 'Hello World!',
  })
})
