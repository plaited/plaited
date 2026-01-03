import { bElement } from 'plaited'

import { styles } from './dynamic-styles.css.ts'

export { styles }

export const DynamicStyleHost = bElement({
  publicEvents: ['render'],
  tag: 'dynamic-style-host',
  shadowDom: (
    <div
      p-target='target'
      {...styles.initial}
    ></div>
  ),
  bProgram({ $ }) {
    return {
      render() {
        const [target] = $<HTMLDivElement>('target')
        target?.insert('beforeend', <div {...styles.noRepeat}>construable stylesheet applied once</div>)
        target?.insert('beforeend', <div {...styles.repeat}>not applied</div>)
      },
    }
  },
})
