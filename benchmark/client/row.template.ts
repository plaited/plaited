import { html, IslandTemplate, template } from '$plaited'
import { Item } from './types.ts'
import { RowTag } from './constants.ts'

export const TableRow = template((item: Item) =>
  IslandTemplate({
    tag: RowTag,
    id: item.id,
    template: html`
    <link href="/css/currentStyle.css" rel="stylesheet" />
    <tr class="${item.selected && 'danger'}">
      <td class="col-md-1">${item.id}</td>
      <td class="col-md-4">
        <a>${item.label}</a>
      </td>
      <td data-id="${item.id}" class="col-md-1" data-interaction='delete'>
        <a>
          <span class="glyphicon glyphicon-remove" aria-hidden="true"></span>
        </a>
      </td>
      <td class="col-md-6"></td>
    </tr>`,
  })
)
