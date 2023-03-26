import { html, isle, template } from '$plaited'
import { PlaitProps } from '../../libs/islandly/types.ts'
import { classes, styles } from './test.styles.ts'
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
            frame.className = classes['test-frame']
            frame.scrolling = 'no'
            const [main] = $<HTMLElement>('main')
            main.replaceChildren(frame)
          },
        })
      }
    },
)

export const TestShellTemplate = (light: string[]) =>
  TestShell.template({
    styles,
    shadow: html`<div class="${classes.shell}">
      <nav class="${classes.nav}">
        <slot name="test-links" data-trigger="click->update"></slot>
      </nav>
      <main data-target="main" class="${classes.main}"></main>
    </div>`,
    light,
  })

export const NavItem = isle(
  { tag: 'nav-item' },
  (base) =>
    class extends base {
      plait(): void | Promise<void> {
      }
    },
)

export const NavItemTemplate = template<{ name: string; path: string }>((
  { name, path },
) =>
  NavItem.template({
    slot: 'test-links',
    styles,
    shadow: html`<li class="${classes.item}">
  <button class="${classes['nav-button']}" value="${path}">${name}</button>
</li>`,
  })
)
