import type { StoryObj } from 'plaited/test'
import type { PlaitedElement } from '../plaited.types.js'
import { Fixture } from './query-bindings.js'

export const beforebegin: StoryObj = {
  template: Fixture,
  play: async ({ findByAttribute, assert }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    let root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root child count shoudl be 100',
      actual: root?.childElementCount,
      expected: 1,
    })
    fixture.trigger({ type: 'insert', detail: 'beforebegin' })
    root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'after calling trigger',
      should: 'root child count should be 101',
      actual: root?.childElementCount,
      expected: 101,
    })
    const table = await findByAttribute<HTMLTableElement>('p-target', 'table')
    assert({
      given: 'after calling trigger',
      should: 'root last child should be the table',
      actual: root?.lastChild,
      expected: table,
    })
  },
}
export const afterbegin: StoryObj = {
  template: Fixture,
  play: async ({ findByAttribute, assert }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const table = await findByAttribute<HTMLTableElement>('p-target', 'table')
    assert({
      given: 'before calling trigger',
      should: 'table children should be empty',
      actual: table?.childElementCount,
      expected: 0,
    })
    fixture.trigger({ type: 'insert', detail: 'afterbegin' })
    assert({
      given: 'before calling trigger',
      should: 'table children should be 100',
      actual: table?.childElementCount,
      expected: 100,
    })
    const lastChild = table?.lastChild
    fixture.trigger({ type: 'insert', detail: 'afterbegin' })
    // @ts-expect-error: allow it to error
    const nodeList = Array.from(table.childNodes)
    assert({
      given: 'after calling trigger again',
      should: 'table children should be 200',
      actual: nodeList.length,
      expected: 200,
    })
    assert({
      given: 'after calling trigger again',
      should: 'original last child should be 200th',
      // @ts-expect-error: allow it to error
      actual: nodeList.indexOf(lastChild),
      expected: 199,
    })
  },
}
export const beforeend: StoryObj = {
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const table = await findByAttribute<HTMLTableElement>('p-target', 'table')
    assert({
      given: 'before calling trigger',
      should: 'table children should be empty',
      actual: table?.childElementCount,
      expected: 0,
    })
    fixture.trigger({ type: 'insert', detail: 'beforeend' })
    assert({
      given: 'before calling trigger',
      should: 'table children should be 100',
      actual: table?.childElementCount,
      expected: 100,
    })
    const lastChild = table?.lastChild
    fixture.trigger({ type: 'insert', detail: 'beforeend' })
    // @ts-expect-error: allow it to error
    const nodeList = Array.from(table.childNodes)
    assert({
      given: 'after calling trigger again',
      should: 'table children should be 200',
      actual: nodeList.length,
      expected: 200,
    })
    assert({
      given: 'after calling trigger again',
      should: 'the original last child should be the 100th child',
      // @ts-expect-error: allow it to error
      actual: nodeList.indexOf(lastChild),
      expected: 99,
    })
  },
}
export const afterend: StoryObj = {
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    let root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root child count should be 1',
      actual: root?.childElementCount,
      expected: 1,
    })
    fixture.trigger({ type: 'insert', detail: 'afterend' })
    root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'after calling trigger',
      should: 'root child count should be 101',
      actual: root?.childElementCount,
      expected: 101,
    })
    const table = await findByAttribute<HTMLTableElement>('p-target', 'table')
    assert({
      given: 'after calling trigger',
      should: 'root first childe should be the table',
      actual: root?.firstChild,
      expected: table,
    })
  },
}
export const render: StoryObj = {
  template: Fixture,
  play: async ({ findByAttribute, assert }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const table = await findByAttribute<HTMLTableElement>('p-target', 'table')
    assert({
      given: 'before calling trigger',
      should: 'table children should be empty',
      actual: table?.childElementCount,
      expected: 0,
    })
    fixture.trigger({ type: 'render' })
    assert({
      given: 'before calling trigger',
      should: 'table children should be 100',
      actual: table?.childElementCount,
      expected: 100,
    })
  },
}
export const replace: StoryObj = {
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root first child should be a table',
      actual: root?.firstChild instanceof HTMLTableElement,
      expected: true,
    })
    fixture.trigger({ type: 'replace' })
    assert({
      given: 'before calling trigger',
      should: 'root first childe children should be a span',
      actual: root?.firstChild instanceof HTMLSpanElement,
      expected: true,
    })
  },
}
export const getAttribute: StoryObj = {
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root firstChild should be a table',
      actual: root?.firstChild instanceof HTMLTableElement,
      expected: true,
    })
    fixture.trigger({ type: 'getAttribute' })
    assert({
      given: 'after calling trigger',
      should: 'root firstChild should be text',
      actual: root?.firstChild instanceof Text,
      expected: true,
    })
  },
}
export const removeAttributes: StoryObj = {
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    fixture.trigger({ type: 'render' })
    let label = await findByAttribute<HTMLDivElement>('p-target', 'label')
    assert({
      given: 'before calling removeAttributes trigger',
      should: 'first found label should be an anchorElement',
      actual: label instanceof HTMLAnchorElement,
      expected: true,
    })
    fixture.trigger({ type: 'removeAttributes' })
    label = await findByAttribute<HTMLDivElement>('p-target', 'label')
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'should not be able to find an element with p-target label',
      actual: label,
      expected: undefined,
    })
  },
}

export const multiSetAttributes: StoryObj = {
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    fixture.trigger({ type: 'render' })
    let el = await findByAttribute<HTMLDivElement>('p-target', 'delete')
    const can = await findByAttribute<HTMLSpanElement>('p-target', 'cancel')
    assert({
      given: 'before calling multiSetAttributes trigger',
      should: 'first found p-target delete element should be an span',
      actual: el instanceof HTMLSpanElement,
      expected: true,
    })
    assert({
      given: 'before calling multiSetAttributes trigger',
      should: 'el should have class',
      actual: el?.getAttribute('class'),
      expected: 'glyphicon glyphicon-remove',
    })
    assert({
      given: 'before calling multiSetAttributes trigger',
      should: 'aria-hiden should be true',
      actual: el?.getAttribute('aria-hidden'),
      expected: 'true',
    })
    assert({
      given: 'before calling multiSetAttributes trigger',
      should: 'should not be able to find an element with p-target cancel',
      actual: can,
      expected: undefined,
    })
    fixture.trigger({ type: 'multiSetAttributes' })
    el = await findByAttribute<HTMLDivElement>('p-target', 'delete')
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'should not be able to find an element with p-target delete',
      actual: el,
      expected: undefined,
    })
    el = await findByAttribute<HTMLDivElement>('p-target', 'cancel')
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'should find an element with p-target cancel',
      actual: el instanceof HTMLSpanElement,
      expected: true,
    })
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'aria-hiden should be false',
      actual: el?.getAttribute('aria-hidden'),
      expected: 'false',
    })
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'el should not have class attribute',
      actual: el?.getAttribute('class'),
      expected: null,
    })
  },
}
