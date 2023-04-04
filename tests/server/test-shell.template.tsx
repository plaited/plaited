import { PlaitedElement } from '$plaited'
import { NavItem, TestShell } from '../client/test.shell.ts'
import { classes, styles } from '../client/test.styles.ts'

export const TestShellTemplate: PlaitedElement = (props) => (
  <TestShell.template stylesheet={styles} slots={props.children}>
    <div class={classes.shell}>
      <nav class={classes.nav}>
        <slot name='test-links' data-trigger={{ click: 'update' }}></slot>
      </nav>
      <main data-target='main' class={classes.main}></main>
    </div>
  </TestShell.template>
)

export const NavItemTemplate: PlaitedElement<{ name: string; path: string }> = (
  { name, path },
) => (
  <NavItem.template stylesheet={styles} slot='test-links'>
    <li class={classes.item}>
      <button class={classes['nav-button']} value={path}>{name}</button>
    </li>
  </NavItem.template>
)
