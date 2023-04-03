import { PlaitedElement } from '$plaited'
import { NavItem, TestShell } from '../client/test.shell.ts'
import { classes, styles } from '../client/test.styles.ts'

export const TestShellTemplate: PlaitedElement = (props) => (
  <TestShell.template styles={styles} slots={props.children}>
    <div className={classes.shell}>
      <nav className={classes.nav}>
        <slot name='test-links' dataTrigger={{ click: 'update' }}></slot>
      </nav>
      <main data-target='main' className={classes.main}></main>
    </div>
  </TestShell.template>
)

export const NavItemTemplate: PlaitedElement<{ name: string; path: string }> = (
  { name, path },
) => (
  <NavItem.template styles={styles} slot='test-links'>
    <li className={classes.item}>
      <button className={classes['nav-button']} value={path}>{name}</button>
    </li>
  </NavItem.template>
)
