import { defineElement, type FT } from 'plaited'

export const trigger = 'add-default-slot'

const Fixture = defineElement({
  tag: 'fixture-element',
  publicEvents: [trigger],
  shadowDom: (
    <>
      <span p-target='stub' />
      <slot name='named'>Named Slot</slot>
    </>
  ),
  bProgram({ $ }) {
    return {
      [trigger]() {
        const [stub] = $('stub')
        stub.replace(<slot>Default Slot</slot>)
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
        src='/Fixture.js'
        type='module'
      />
      <Fixture />
    </body>
  </html>
)
