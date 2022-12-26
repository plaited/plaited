import { html, wire, classNames, Template } from '@plaited/island'
import styles from './button.module.css'

export const button: Template<{children: string, [key: string]: unknown}> = ({
  children,
  target,
  triggers,
  className,
  ...rest
}) =>  html`
<button ${wire({
    target,
    triggers,
    className: classNames(className, styles.button),
    ...rest,
  })}
>
  ${children}
</button>`
