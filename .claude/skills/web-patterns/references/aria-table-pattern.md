# ARIA Table Pattern

## Overview

Like an HTML `table` element, a WAI-ARIA table is a static tabular structure containing one or more rows that each contain one or more cells; it is not an interactive widget. Thus, its cells are not focusable or selectable. The grid pattern is used to make an interactive widget that has a tabular structure.

**Key Characteristics:**
- **Static structure**: Not an interactive widget
- **Tabular data**: Rows and cells for presenting data
- **No keyboard interaction**: Cells are not focusable or selectable
- **Can contain widgets**: Tables can contain interactive widgets (buttons, links), but each widget is a separate tab stop
- **Native HTML preferred**: Strongly encouraged to use native `<table>` element

**Important Notes:**
- Tables are **not** interactive widgets - use Grid pattern for interactive tabular data
- If a table contains many interactive widgets, consider using Grid pattern to reduce tab sequence length
- Native HTML `<table>` element is strongly preferred over ARIA `role="table"`
- Tables can have sortable columns (using `aria-sort` on headers)

**Differences from Grid Pattern:**
- Table: Static structure, all interactive elements are in tab sequence
- Grid: Interactive widget, single tab stop, arrow key navigation

## Use Cases

- Data presentation (product lists, user data, reports)
- Sortable data tables
- Static information display
- Tabular content with embedded widgets (buttons, links)
- Financial data tables
- Comparison tables
- Schedule/timetable displays

## Implementation

### Vanilla JavaScript

```html
<!-- Native HTML table -->
<table>
  <caption>Product Inventory</caption>
  <thead>
    <tr>
      <th scope="col">Product</th>
      <th scope="col">Price</th>
      <th scope="col">Stock</th>
      <th scope="col">Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Widget A</th>
      <td>$10.00</td>
      <td>50</td>
      <td>
        <button>Edit</button>
        <button>Delete</button>
      </td>
    </tr>
  </tbody>
</table>

<!-- ARIA table (when native element can't be used) -->
<div role="table" aria-label="Product Inventory">
  <div role="rowgroup">
    <div role="row">
      <div role="columnheader">Product</div>
      <div role="columnheader">Price</div>
      <div role="columnheader">Stock</div>
    </div>
  </div>
  <div role="rowgroup">
    <div role="row">
      <div role="rowheader">Widget A</div>
      <div role="cell">$10.00</div>
      <div role="cell">50</div>
    </div>
  </div>
</div>

<!-- Sortable table -->
<table>
  <thead>
    <tr>
      <th scope="col" aria-sort="ascending">
        <button>Name</button>
      </th>
      <th scope="col" aria-sort="none">
        <button>Price</button>
      </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Product A</td>
      <td>$10.00</td>
    </tr>
  </tbody>
</table>
```

```javascript
// Sortable table implementation
function sortTable(columnIndex, direction) {
  const tbody = document.querySelector('tbody')
  const rows = Array.from(tbody.querySelectorAll('tr'))
  
  rows.sort((a, b) => {
    const aValue = a.cells[columnIndex].textContent
    const bValue = b.cells[columnIndex].textContent
    return direction === 'ascending' 
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue)
  })
  
  rows.forEach(row => tbody.appendChild(row))
  
  // Update aria-sort on headers
  document.querySelectorAll('th').forEach((th, idx) => {
    if (idx === columnIndex) {
      th.setAttribute('aria-sort', direction)
    } else {
      th.setAttribute('aria-sort', 'none')
    }
  })
}
```

### Plaited Adaptation

**Important**: In Plaited, tables can be implemented as:
1. **Functional Templates (FT)** for static tables in stories
2. **bElements** for dynamic tables that need sorting, filtering, or data updates
3. **Native HTML `<table>`** when possible (strongly preferred)

#### Static Table (Functional Template)

```typescript
// table.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { tableStyles } from './table.css.ts'

type TableCell = {
  content: Children
  header?: boolean
  scope?: 'col' | 'row' | 'colgroup' | 'rowgroup'
  colspan?: number
  rowspan?: number
}

type TableRow = {
  cells: TableCell[]
}

type TableProps = {
  caption?: string
  'aria-label'?: string
  headers?: TableRow
  rows: TableRow[]
}

const Table: FT<TableProps> = ({
  caption,
  'aria-label': ariaLabel,
  headers,
  rows,
  ...attrs
}) => (
  <table
    aria-label={ariaLabel}
    {...attrs}
    {...joinStyles(tableStyles.table)}
  >
    {caption && <caption {...tableStyles.caption}>{caption}</caption>}
    {headers && (
      <thead {...tableStyles.thead}>
        <tr {...tableStyles.tr}>
          {headers.cells.map((cell, idx) =>
            cell.header ? (
              <th
                key={idx}
                scope={cell.scope || 'col'}
                colSpan={cell.colspan}
                rowSpan={cell.rowspan}
                {...tableStyles.th}
              >
                {cell.content}
              </th>
            ) : (
              <td
                key={idx}
                colSpan={cell.colspan}
                rowSpan={cell.rowspan}
                {...tableStyles.td}
              >
                {cell.content}
              </td>
            )
          )}
        </tr>
      </thead>
    )}
    <tbody {...tableStyles.tbody}>
      {rows.map((row, rowIdx) => (
        <tr key={rowIdx} {...tableStyles.tr}>
          {row.cells.map((cell, cellIdx) =>
            cell.header ? (
              <th
                key={cellIdx}
                scope={cell.scope || 'row'}
                colSpan={cell.colspan}
                rowSpan={cell.rowspan}
                {...tableStyles.th}
              >
                {cell.content}
              </th>
            ) : (
              <td
                key={cellIdx}
                colSpan={cell.colspan}
                rowSpan={cell.rowspan}
                {...tableStyles.td}
              >
                {cell.content}
              </td>
            )
          )}
        </tr>
      ))}
    </tbody>
  </table>
)

export const productTable = story({
  intent: 'Product inventory table',
  template: () => (
    <Table
      caption='Product Inventory'
      headers={{
        cells: [
          { content: 'Product', header: true, scope: 'col' },
          { content: 'Price', header: true, scope: 'col' },
          { content: 'Stock', header: true, scope: 'col' },
        ],
      }}
      rows={[
        {
          cells: [
            { content: 'Widget A', header: true, scope: 'row' },
            { content: '$10.00' },
            { content: '50' },
          ],
        },
        {
          cells: [
            { content: 'Widget B', header: true, scope: 'row' },
            { content: '$15.00' },
            { content: '30' },
          ],
        },
      ]}
    />
  ),
})
```

#### Dynamic Table (bElement)

```typescript
import { bElement, useTemplate, type FT } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const tableStyles = createStyles({
  table: {
    inlineSize: '100%',
    borderCollapse: 'collapse',
    border: '1px solid #ccc',
  },
  caption: {
    fontSize: '1.125rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    textAlign: 'left',
  },
  thead: {
    backgroundColor: '#f0f0f0',
  },
  tbody: {
    // Styles
  },
  tr: {
    borderBottom: '1px solid #e0e0e0',
    '&:hover': {
      backgroundColor: '#f9f9f9',
    },
  },
  th: {
    padding: '0.75rem',
    textAlign: 'left',
    fontWeight: 'bold',
    borderRight: '1px solid #e0e0e0',
  },
  td: {
    padding: '0.75rem',
    borderRight: '1px solid #e0e0e0',
  },
  sortButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem',
    fontWeight: 'inherit',
    textAlign: 'inherit',
    inlineSize: '100%',
    '&:hover': {
      backgroundColor: '#e0e0e0',
    },
  },
})

type TableData = {
  id: string
  [key: string]: string | number | unknown
}

type TableColumn = {
  key: string
  label: string
  sortable?: boolean
}

type TableEvents = {
  sort: { column: string; direction: 'ascending' | 'descending' }
  rowClick: { row: TableData; index: number }
}

const RowTemplate: FT<{ data: TableData; columns: TableColumn[] }> = ({
  data,
  columns,
}) => (
  <tr>
    {columns.map((col, idx) => (
      <td key={idx} p-target={`cell-${col.key}`}>
        {String(data[col.key] || '')}
      </td>
    ))}
  </tr>
)

export const DataTable = bElement<TableEvents>({
  tag: 'data-table',
  observedAttributes: ['data', 'columns', 'aria-label'],
  shadowDom: (
    <table
      p-target='table'
      {...tableStyles.table}
    >
      <caption p-target='caption'></caption>
      <thead p-target='thead' {...tableStyles.thead}>
        <tr p-target='header-row' {...tableStyles.tr}></tr>
      </thead>
      <tbody p-target='tbody' {...tableStyles.tbody}></tbody>
      <template p-target='row-template'>
        <RowTemplate data={{}} columns={[]} />
      </template>
    </table>
  ),
  bProgram({ $, host, emit, root }) {
    const table = $('table')[0]
    const caption = $('caption')[0]
    const thead = $('thead')[0]
    const headerRow = $('header-row')[0]
    const tbody = $('tbody')[0]
    const rowTemplate = $<HTMLTemplateElement>('row-template')[0]
    
    let columns: TableColumn[] = []
    let data: TableData[] = []
    let sortColumn: string | null = null
    let sortDirection: 'ascending' | 'descending' = 'ascending'
    
    const renderHeaders = () => {
      if (!headerRow || columns.length === 0) return
      
      const headers = columns.map((col, idx) => (
        <th
          key={idx}
          scope='col'
          aria-sort={col.sortable && sortColumn === col.key ? sortDirection : 'none'}
          {...tableStyles.th}
        >
          {col.sortable ? (
            <button
              p-target={`sort-${col.key}`}
              {...tableStyles.sortButton}
              p-trigger={{ click: 'handleSort' }}
              data-column={col.key}
            >
              {col.label}
            </button>
          ) : (
            col.label
          )}
        </th>
      ))
      
      headerRow.render(...headers)
    }
    
    const renderRows = () => {
      if (!tbody || !rowTemplate || data.length === 0) return
      
      const createRow = useTemplate(rowTemplate, ($, rowData: TableData) => {
        columns.forEach(col => {
          const cell = $(`cell-${col.key}`)[0]
          cell?.render(String(rowData[col.key] || ''))
        })
      })
      
      const rows = data.map(createRow)
      tbody.render(...rows)
    }
    
    const sortData = (columnKey: string, direction: 'ascending' | 'descending') => {
      const column = columns.find(c => c.key === columnKey)
      if (!column) return
      
      data.sort((a, b) => {
        const aValue = a[columnKey]
        const bValue = b[columnKey]
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return direction === 'ascending' ? aValue - bValue : bValue - aValue
        }
        
        const aStr = String(aValue || '')
        const bStr = String(bValue || '')
        return direction === 'ascending'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr)
      })
      
      sortColumn = columnKey
      sortDirection = direction
      renderHeaders()
      renderRows()
      
      emit({ type: 'sort', detail: { column: columnKey, direction } })
    }
    
    return {
      handleSort(event: { target: HTMLElement }) {
        const columnKey = event.target.getAttribute('data-column')
        if (!columnKey) return
        
        const newDirection =
          sortColumn === columnKey && sortDirection === 'ascending'
            ? 'descending'
            : 'ascending'
        
        sortData(columnKey, newDirection)
      },
      
      onConnected() {
        const dataAttr = host.getAttribute('data')
        const columnsAttr = host.getAttribute('columns')
        const ariaLabel = host.getAttribute('aria-label')
        const captionText = host.getAttribute('caption')
        
        if (columnsAttr) {
          try {
            columns = JSON.parse(columnsAttr)
            renderHeaders()
          } catch {
            // Invalid JSON
          }
        }
        
        if (dataAttr) {
          try {
            data = JSON.parse(dataAttr)
            renderRows()
          } catch {
            // Invalid JSON
          }
        }
        
        if (ariaLabel) {
          table?.setAttribute('aria-label', ariaLabel)
        }
        
        if (captionText) {
          caption?.render(captionText)
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'data' && newValue) {
          try {
            data = JSON.parse(newValue)
            renderRows()
          } catch {
            // Invalid JSON
          }
        } else if (name === 'columns' && newValue) {
          try {
            columns = JSON.parse(newValue)
            renderHeaders()
            renderRows()
          } catch {
            // Invalid JSON
          }
        } else if (name === 'aria-label') {
          table?.setAttribute('aria-label', newValue || '')
        } else if (name === 'caption') {
          caption?.render(newValue || '')
        }
      },
    }
  },
})
```

#### Sortable Table Example

```typescript
export const sortableTable = story({
  intent: 'Sortable data table',
  template: () => (
    <DataTable
      caption='Product Inventory'
      aria-label='Product inventory with sortable columns'
      columns={JSON.stringify([
        { key: 'name', label: 'Product', sortable: true },
        { key: 'price', label: 'Price', sortable: true },
        { key: 'stock', label: 'Stock', sortable: true },
      ])}
      data={JSON.stringify([
        { id: '1', name: 'Widget A', price: 10, stock: 50 },
        { id: '2', name: 'Widget B', price: 15, stock: 30 },
        { id: '3', name: 'Widget C', price: 20, stock: 75 },
      ])}
    />
  ),
})
```

#### Table with Interactive Widgets

```typescript
export const TableWithActions = bElement<{
  edit: { row: TableData; index: number }
  delete: { row: TableData; index: number }
}>({
  tag: 'table-with-actions',
  observedAttributes: ['data'],
  shadowDom: (
    <table p-target='table' {...tableStyles.table}>
      <thead p-target='thead' {...tableStyles.thead}>
        <tr>
          <th scope='col'>Name</th>
          <th scope='col'>Price</th>
          <th scope='col'>Actions</th>
        </tr>
      </thead>
      <tbody p-target='tbody' {...tableStyles.tbody}></tbody>
    </table>
  ),
  bProgram({ $, host, emit, root }) {
    const tbody = $('tbody')[0]
    let data: TableData[] = []
    
    const renderRows = () => {
      if (!tbody) return
      
      const rows = data.map((row, index) => (
        <tr key={row.id}>
          <td>{row.name}</td>
          <td>${row.price}</td>
          <td>
            <button
              p-trigger={{ click: 'handleEdit' }}
              data-index={String(index)}
            >
              Edit
            </button>
            <button
              p-trigger={{ click: 'handleDelete' }}
              data-index={String(index)}
            >
              Delete
            </button>
          </td>
        </tr>
      ))
      
      tbody.render(...rows)
    }
    
    return {
      handleEdit(event: { target: HTMLElement }) {
        const index = Number(event.target.getAttribute('data-index'))
        emit({ type: 'edit', detail: { row: data[index], index } })
      },
      
      handleDelete(event: { target: HTMLElement }) {
        const index = Number(event.target.getAttribute('data-index'))
        emit({ type: 'delete', detail: { row: data[index], index } })
      },
      
      onConnected() {
        const dataAttr = host.getAttribute('data')
        if (dataAttr) {
          try {
            data = JSON.parse(dataAttr)
            renderRows()
          } catch {
            // Invalid JSON
          }
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'data' && newValue) {
          try {
            data = JSON.parse(newValue)
            renderRows()
          } catch {
            // Invalid JSON
          }
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - tables can be used in bElement shadowDom
- **Uses bElement built-ins**: Yes - `$` for querying, `render()` for dynamic content, `useTemplate()` for efficient row rendering
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

**Not applicable** - Tables are static structures. Cells are not focusable or selectable. Interactive widgets within table cells (buttons, links) have their own keyboard interactions.

**Note**: If a table contains many interactive widgets, consider using the Grid pattern instead to reduce tab sequence length.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="table"**: Container element (or use native `<table>`)
- **role="row"**: Each row container (or use native `<tr>`)
- **role="cell"**: Regular cell (or use native `<td>`)

### Optional

- **role="columnheader"**: Header cell for column (or use native `<th scope="col">`)
- **role="rowheader"**: Header cell for row (or use native `<th scope="row">`)
- **role="rowgroup"**: Group of rows (or use native `<thead>`, `<tbody>`, `<tfoot>`)
- **aria-label** or **aria-labelledby**: Accessible name for table
- **aria-describedby**: References element providing description
- **aria-sort**: `ascending`, `descending`, or `none` on sortable column headers
- **aria-colcount**: Total number of columns (when some hidden)
- **aria-rowcount**: Total number of rows (when some hidden)
- **aria-colindex**: Column position (when using aria-colcount)
- **aria-rowindex**: Row position (when using aria-rowcount)
- **aria-rowspan**: Number of rows spanned by cell
- **aria-colspan**: Number of columns spanned by cell

### Native HTML Table Elements

- **`<table>`**: Table container
- **`<caption>`**: Table caption
- **`<thead>`**: Header row group
- **`<tbody>`**: Body row group
- **`<tfoot>`**: Footer row group
- **`<tr>`**: Table row
- **`<th>`**: Header cell (with `scope="col"` or `scope="row"`)
- **`<td>`**: Data cell
- **`colspan`**: Number of columns spanned
- **`rowspan`**: Number of rows spanned

## Best Practices

1. **Use native `<table>`** - Strongly preferred over ARIA roles
2. **Functional Templates** - Use FT for static tables in stories
3. **bElement for dynamic** - Use bElement for sortable, filterable, or data-driven tables
4. **Proper headers** - Use `<th>` with `scope` attribute
5. **Caption or label** - Always provide `<caption>` or `aria-label`
6. **Sortable columns** - Use `aria-sort` on sortable headers
7. **Row groups** - Use `<thead>`, `<tbody>`, `<tfoot>` for structure
8. **Consider Grid** - Use Grid pattern if table has many interactive widgets
9. **Cell spanning** - Use `colspan` and `rowspan` appropriately
10. **Accessible names** - Provide labels for table and headers

## Accessibility Considerations

- Screen readers announce table structure and relationships
- Headers help users understand cell relationships
- Caption or label helps users understand table purpose
- Sortable columns should indicate sort state
- Interactive widgets within cells are separate tab stops
- Tables with many interactive widgets may benefit from Grid pattern
- Proper use of `scope` attribute helps screen readers understand structure

## Table Variants

### Static Table
- Simple data presentation
- No interactivity
- Use Functional Template

### Sortable Table
- Clickable column headers
- `aria-sort` indicates sort state
- Use bElement for state management

### Table with Actions
- Contains buttons/links in cells
- Each widget is separate tab stop
- Consider Grid if many widgets

### Responsive Table
- Adapts to screen size
- May stack on mobile
- Maintains accessibility

## Table vs. Grid

| Feature | Table | Grid |
|---------|-------|------|
| **Type** | Static structure | Interactive widget |
| **Tab stops** | All interactive elements | Single tab stop |
| **Keyboard** | None (static) | Arrow keys, Home, End |
| **Focus** | On interactive widgets | On cells |
| **Use case** | Data presentation | Interactive data editing |

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support (native `<table>`) |
| Firefox | Full support (native `<table>`) |
| Safari | Full support (native `<table>`) |
| Edge | Full support (native `<table>`) |

**Note**: Native HTML `<table>` element has universal support. ARIA `role="table"` is a newer feature (ARIA 1.1) and should be tested thoroughly with assistive technologies.

## References

- Source: [W3C ARIA Authoring Practices Guide - Table Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/)
- MDN: [HTML table element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/table)
- MDN: [ARIA table role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/table_role)
- Related: [Grid Pattern](./aria-grid-pattern.md) - For interactive tabular data
- Related: [Grid and Table Properties Practice](https://www.w3.org/WAI/ARIA/apg/practices/grid-and-table-properties/)
