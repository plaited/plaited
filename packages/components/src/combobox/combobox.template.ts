import { Template, html, wire, classNames, island } from '@plaited/island'
import styles from './combobox.module.css'

export const combobox:Template<{
  children: string
  [key: string]: unknown
  id?: string
  label?: string
}> = ({
  children,
  target,
  triggers,
  className,
  id,
  label,
  htmlFor,
  ...rest
}) => html`${island({
  tag: 'plaited-combobox',
  template: html`<label for="${htmlFor}">${label}</label>
  <input type="text" ${wire({
    target,
    triggers,
    id,
    ...rest,
  })}/>
  <ul><slot></slot></ul>`,
})}
<div class="${classNames(className, styles.button)}">
  
</div>`
