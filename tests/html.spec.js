import {assert} from '@plaited/assert'
import {html} from '../src'

describe('html()', function () {
  it('test output', function () {
    const data = {
      helloWorld: 'Hello World!!!',
      people: ['Dante', 'Alisia', 'Rose'],
      flowers: [
        {
          name: `Scientific Name:Rose
      Common Name: Rose`,
          colors: ['red', 'pink'],
        },
        {
          name: `Scientific Name: Tulipa
      Common Name: Tulip`,
          colors: ['yellow', 'deep red'],
        },
      ],
    }
    const template1 = html`
    <span>thing</span>
    `
    const template2 = html`
      <span>
        ${data.helloWorld}
      </span>
    `
    const template3 = html`
    <ul>
      ${data.people.map(
    person => html`<li>${person}</li>`,
  )}
    </ul>
    `
    const template4 = html`
    <ul>
      ${data.flowers.map(({name, colors}) => html`<li>
        <h1>${name}</h1>
        <span> Favorite Colors</span>
        <ul>
          ${colors.map(color => html`<li>${color}</li>`)}
        </ul>
      </li>`)}
    </ul>`
    const falseyTemplate1 = bool => html`<div>${bool}</div>`
    const falseyArray = [
      'Loki',
      'Anasi',
      undefined,
      'Raven',
    ]
    const falseyTemplate2 = html`<ul>${falseyArray.map(name => html`<span>${name}</span>`)}</ul>`

    assert({
      given: 'simple html string',
      should: 'return simple string',
      actual: template1,
      expected: '<span>thing</span>',
    })
    assert({
      given: 'html string with placeholder',
      should: 'return html string with interpolated expression',
      actual: template2,
      expected: '<span>Hello World!!!</span>',
    })
    assert({
      given: 'html string with a mapped placeholder',
      should: 'return html string with interpolated expression',
      actual: template3,
      expected: '<ul><li>Dante</li><li>Alisia</li><li>Rose</li></ul>',
    })
    assert({
      given: 'deeply nested template',
      should: 'return html string with interpolated expression',
      actual: template4,
      expected: `<ul><li><h1>Scientific Name:Rose
      Common Name: Rose</h1><span>Favorite Colors</span><ul><li>red</li><li>pink</li></ul></li><li><h1>Scientific Name: Tulipa
      Common Name: Tulip</h1><span>Favorite Colors</span><ul><li>yellow</li><li>deep red</li></ul></li></ul>`,
    })
    assert({
      given: 'false expression',
      should: 'return empty div',
      actual: falseyTemplate1(undefined),
      expected: '<div></div>',
    })
    assert({
      given: 'array with false value',
      should: 'return one empty span',
      actual: falseyTemplate2,
      expected: '<ul><span>Loki</span><span>Anasi</span><span></span><span>Raven</span></ul>',
    })
  })
})
