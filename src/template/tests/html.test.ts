import test from 'ava'
import { noop } from '@plaited/utils'
import { html } from '../mod.ts'

test('html()', (t) => {
  t.is(html` <div>hello</div> `, '<div>hello</div>', 'trims white space')
  t.is(html` <div>${false}</div> `, '<div></div>', 'filters false out')
  t.is(html` <div>${undefined}</div> `, '<div></div>', 'filters undefined out')
  t.is(html` <div>${null}</div> `, '<div></div>', 'filters null out')
  t.is(html` <div>${noop()}</div> `, '<div></div>', 'filters void out')
  t.is(html` <div>${0}</div> `, '<div>0</div>', 'keeps 0')
  t.is(
    html` <ul>${
      Array.from(Array(10).keys()).map((n) => html`<li>   ${n}</li>`)
    }</ul> `,
    '<ul><li>0</li><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li><li>8</li><li>9</li></ul>',
    'map over array',
  )
  t.is(
    html` <div>
    <span>
      multiline 
         element
    </span>
  </div> 
   `,
    '<div><span>multiline element</span></div>',
    'minimizes multiline',
  )
  t.is(
    html` <div data-target="click->hello focus->goodbye">hello</div> `,
    '<div data-target="click->hello focus->goodbye">hello</div>',
    `doesn't remove white space on attributes`,
  )
  t.is(
    html` <div>$${'<script> exit 1</script>'}</div> `,
    '<div>&lt;script&gt; exit 1&lt;/script&gt;</div>',
    'escapes data',
  )
})
