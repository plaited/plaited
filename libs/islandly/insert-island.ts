export const insertIsland = ({ el, island, position = 'beforeend' }: {
  /** element to insert island into, before or after */
  el: Element
  /** Island template string to be inserted */
  island: string
  /** insert position defaults to "beforeend" */
  position?: InsertPosition
}) => {
  const fragment = new DOMParser().parseFromString(
    island,
    'text/html',
    //@ts-ignore: new spec feature
    {
      includeShadowRoots: true,
    },
  )
  el?.insertAdjacentElement(
    position,
    //@ts-ignore: exist
    fragment.body.firstChild,
  )
}
