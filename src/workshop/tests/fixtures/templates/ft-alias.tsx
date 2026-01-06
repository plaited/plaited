import type { FT } from 'plaited/ui'

export const FTSimple: FT = () => <div>FT Alias Simple</div>

export const FTWithProps: FT<{
  title: string
  content: string
}> = (props) => (
  <article>
    <h2>{props?.title || 'Default Title'}</h2>
    <p>{props?.content || 'Default content'}</p>
  </article>
)

export const FTComplex: FT = () => (
  <nav>
    <ul>
      <li>Item 1</li>
      <li>Item 2</li>
      <li>Item 3</li>
    </ul>
  </nav>
)
