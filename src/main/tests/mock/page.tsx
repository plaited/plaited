import { defineElement, type FT } from 'plaited'

export const DEFINE = 'define-element'
export const FIXTURE_ELEMENT_TAG = 'fixture-element'
export const EMPTY_SLOT = 'Empty slot'

const Fixture = defineElement({
  tag: FIXTURE_ELEMENT_TAG,
  publicEvents: [DEFINE],
  streamAssociated: true,
  shadowDom: (
    <>
      <slot>{EMPTY_SLOT}</slot>
      <span p-target='stub' />
    </>
  ),
  bProgram({ $ }) {
    return {
      [DEFINE]() {
        const [stub] = $('stub')
        stub.replace(
          <script
            trusted
            src='/hydrating-element.js'
            type='module'
          />,
        )
      },
    }
  },
})

export const Page: FT<{ libraryImportMap: Record<string, string> }> = ({ libraryImportMap }) => (
  <html>
    <head>
      <title>Streaming Fixture</title>
      <link
        rel='shortcut icon'
        href='#'
      />
      <script
        trusted
        type='importmap'
      >
        {JSON.stringify({
          imports: libraryImportMap,
        })}
      </script>
    </head>
    <body>
      <script
        trusted
        src='/page.js'
        type='module'
      />
      <Fixture />
    </body>
  </html>
)
