import { Assertion } from '$assert'
import { useIndexedDB } from '$plaited'

export const slotTest = () => {
  // Slot triggers need to be tested here
  // nested slots need to be tested here they should add event listeners
}
export const islandIdTest = () => {
  // need to test comms using id on element
}
export const noDeclarativeShadowDomTest = () => {
  // need to create a custom element and attaching shadow
  // in the the connected callback and then querying dom
}
export const templateObserverTest = () => {
  // Need to test adding a template after connected callback is called and waiting
  // and if the shadow dom contains content.
}
export const shadowObserverTest = () => {
  // need to test adding nodes without attributes
  // need to test modifying attributes on node
  // need to test adding slot element to this
  // need to test adding svg with attribute to this.
}

export const dynamicIslandTest = () => {
  // dynamically add island to screen
  // does it upgrade with styles
  // is it interactive
}

export const calculatorTest = () => {
  // should be an example of a ui and also test worker connection
}

export const useIndexedDBTest = async (assert: Assertion) => {
  const [get, set] = await useIndexedDB<number>('testKey', 0)
  let actual = await get()
  assert({
    given: 'get',
    should: 'return 0',
    actual,
    expected: 0,
  })
  await set(4)
  actual = await get()
  assert({
    given: 'set with 4',
    should: 'return 4',
    actual,
    expected: 4,
  })
  await set((x) => x + 1)
  actual = await get()
  assert({
    given: 'callback with previous value',
    should: 'return 5',
    actual,
    expected: 5,
  })
  const [get2] = await useIndexedDB('testKey', 1)
  actual = await get2()
  assert({
    given: 'another useIndexedDB with same key but different initial value',
    should: 'return new initial value',
    actual,
    expected: 1,
  })
}
