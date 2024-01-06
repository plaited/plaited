import { FunctionTemplate, css } from 'plaited'

const { $stylesheet, ...cls } = css`
  .x {
    width: 20px;
    height: 20px;
    color: #a9d9d0;
  }
`

export const XMarker: FunctionTemplate = () => (
  <svg
    className={cls.x}
    stylesheet={$stylesheet}
    viewBox='0 0 21 21'
    fill='none'
  >
    <path
      d='M16 0.900002C16.5 0.400002 17.1 0.200001 17.8 0.200001C19.2 0.200001 20.3 1.3 20.3 2.7C20.3 3.4 20 4 19.6 4.5L13.8 10.2L19.4 15.8L19.5 15.9C20 16.4 20.2 17 20.2 17.7C20.2 19.1 19.1 20.2 17.7 20.2C17 20.2 16.4 19.9 15.9 19.5L15.8 19.4L15.7 19.3L10.1 13.7L4.4 19.4C3.9 19.9 3.3 20.1 2.6 20.1C1.2 20.1 0.0999985 19 0.0999985 17.6C0.0999985 16.9 0.399995 16.3 0.799995 15.8L6.5 10.1L0.900002 4.5L0.699997 4.3C0.199997 3.9 0 3.2 0 2.5C0 1.1 1.1 0 2.5 0C3.2 0 3.8 0.300001 4.3 0.700001L4.4 0.799999L10.1 6.4L16 0.900002Z'
      fill='currentColor'
    />
  </svg>
)
