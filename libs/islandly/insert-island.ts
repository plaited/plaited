export const insertIsland = ({ el, template, position = 'beforeend' }: {
  /** element to insert island into, before or after */
  el: Element
  /** Island template string to be inserted */
  template: string
  /** insert position defaults to "beforeend" */
  position?: InsertPosition
}) => {
  const fragment = new DOMParser().parseFromString(
    template,
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
