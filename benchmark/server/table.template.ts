import { html, IslandTemplate } from '$plaited'
import { TableTag } from '../client/constants.ts'

export const TableTemplate = IslandTemplate({
  triggers: {
    click: 'interact',
  },
  tag: TableTag,
  template: html`<link href="/css/currentStyle.css" rel="stylesheet" />
  <table data-trigger="click->interact" class="table table-hover table-striped test-data">
    <tbody data-target="tbody"></tbody>
  </table>`,
})
