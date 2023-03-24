/** Takes an island template and returns node */
export const isleNode = (template: string) => {
  const fragment = new DOMParser().parseFromString(
    template,
    'text/html',
    //@ts-ignore: new spec feature
    {
      includeShadowRoots: true,
    },
  )
  return fragment.body.firstChild?.cloneNode(true) as Node
}
