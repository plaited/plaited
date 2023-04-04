import { isle } from '$plaited'
import { PlaitProps } from '../../libs/islandly/types.ts'
import { classes } from './test.styles.ts'
export const TestShell = isle(
  { tag: 'test-shell' },
  (base) =>
    class extends base {
      plait({ feedback, $ }: PlaitProps): void | Promise<void> {
        feedback({
          update(e: MouseEvent) {
            const target = e.composedPath()[0] as HTMLButtonElement
            const ref = target.value
            const frame = document.createElement('iframe')
            frame.src = ref
            frame.class = classes['test-frame']
            frame.scrolling = 'no'
            const [main] = $<HTMLElement>('main')
            main.replaceChildren(frame)
          },
        })
      }
    },
)

export const NavItem = isle({ tag: 'nav-item' })
