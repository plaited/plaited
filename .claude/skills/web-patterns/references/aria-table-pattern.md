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

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

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

**File Structure:**

```
table/
  table.css.ts        # Styles (createStyles) - ALWAYS separate
  table.stories.tsx   # FT/bElement + stories (imports from css.ts)
```

#### table.css.ts

```typescript
// table.css.ts
import { createStyles } from 'plaited'

export const styles = createStyles({
  table: {
    inlineSize: '100%',
    borderCollapse: 'collapse',
    border: '1px solid #ccc',
  },
  caption: {
    fontSize: '1.125rem',
    fontWeight: 'bold',
    marginBlockEnd: '0.5rem',
    textAlign: 'start',
    captionSide: 'top',
  },
  thead: {
    backgroundColor: '#f0f0f0',
  },
  tbody: {
    backgroundColor: '#fff',
  },
  tr: {
    borderBlockEnd: '1px solid #e0e0e0',
  },
  th: {
    padding: '0.75rem',
    textAlign: 'start',
    fontWeight: 'bold',
    borderInlineEnd: '1px solid #e0e0e0',
  },
  td: {
    padding: '0.75rem',
    borderInlineEnd: '1px solid #e0e0e0',
  },
  sortButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem',
    fontWeight: 'inherit',
    textAlign: 'inherit',
    inlineSize: '100%',
  },
})
```

#### table.stories.tsx

```typescript
// table.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles } from './table.css.ts'

// Types - defined locally
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

// FunctionalTemplate for static table - defined locally, NOT exported
const Table: FT<TableProps> = ({
  caption,
  'aria-label': ariaLabel,
  headers,
  rows,
  ...attrs
}) => (
  <table aria-label={ariaLabel} {...attrs} {...styles.table}>
    {caption && <caption {...styles.caption}>{caption}</caption>}
    {headers && (
      <thead {...styles.thead}>
        <tr {...styles.tr}>
          {headers.cells.map((cell, idx) =>
            cell.header ? (
              <th
                key={idx}
                scope={cell.scope || 'col'}
                colSpan={cell.colspan}
                rowSpan={cell.rowspan}
                {...styles.th}
              >
                {cell.content}
              </th>
            ) : (
              <td
                key={idx}
                colSpan={cell.colspan}
                rowSpan={cell.rowspan}
                {...styles.td}
              >
                {cell.content}
              </td>
            )
          )}
        </tr>
      </thead>
    )}
    <tbody {...styles.tbody}>
      {rows.map((row, rowIdx) => (
        <tr key={rowIdx} {...styles.tr}>
          {row.cells.map((cell, cellIdx) =>
            cell.header ? (
              <th
                key={cellIdx}
                scope={cell.scope || 'row'}
                colSpan={cell.colspan}
                rowSpan={cell.rowspan}
                {...styles.th}
              >
                {cell.content}
              </th>
            ) : (
              <td
                key={cellIdx}
                colSpan={cell.colspan}
                rowSpan={cell.rowspan}
                {...styles.td}
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

// Stories - EXPORTED for testing/training
export const productTable = story({
  intent: 'Product inventory table with row headers',
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
  play: async ({ findByRole, assert }) => {
    const table = await findByRole('table')

    assert({
      given: 'table is rendered',
      should: 'have accessible name from caption',
      actual: table?.querySelector('caption')?.textContent,
      expected: 'Product Inventory',
    })
  },
})

export const simpleTable = story({
  intent: 'Simple data table without row headers',
  template: () => (
    <Table
      aria-label='User List'
      headers={{
        cells: [
          { content: 'Name', header: true, scope: 'col' },
          { content: 'Email', header: true, scope: 'col' },
          { content: 'Role', header: true, scope: 'col' },
        ],
      }}
      rows={[
        {
          cells: [
            { content: 'Alice' },
            { content: 'alice@example.com' },
            { content: 'Admin' },
          ],
        },
        {
          cells: [
            { content: 'Bob' },
            { content: 'bob@example.com' },
            { content: 'User' },
          ],
        },
      ]}
    />
  ),
  play: async ({ findByRole, assert }) => {
    const table = await findByRole('table')

    assert({
      given: 'table is rendered',
      should: 'have aria-label',
      actual: table?.getAttribute('aria-label'),
      expected: 'User List',
    })
  },
})

export const tableAccessibility = story({
  intent: 'Verify table accessibility structure',
  template: () => (
    <Table
      caption='Accessibility Test Table'
      headers={{
        cells: [
          { content: 'Header 1', header: true, scope: 'col' },
          { content: 'Header 2', header: true, scope: 'col' },
        ],
      }}
      rows={[
        {
          cells: [
            { content: 'Row 1', header: true, scope: 'row' },
            { content: 'Data 1' },
          ],
        },
      ]}
    />
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - tables can be used in bElement shadowDom
- **Uses bElement built-ins**: `$`, `render()`, `p-trigger` for dynamic tables
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
- **aria-sort**: `ascending`, `descending`, or `none` on sortable column headers

## Best Practices

1. **Use native `<table>`** - Strongly preferred over ARIA roles
2. **Use FunctionalTemplates** for static tables in stories
3. **Use bElement** for sortable, filterable, or data-driven tables
4. **Use spread syntax** - `{...styles.x}` for applying styles
5. **Proper headers** - Use `<th>` with `scope` attribute
6. **Caption or label** - Always provide `<caption>` or `aria-label`
7. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce table structure and relationships
- Headers help users understand cell relationships
- Caption or label helps users understand table purpose
- Proper use of `scope` attribute helps screen readers understand structure

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support (native `<table>`) |
| Firefox | Full support (native `<table>`) |
| Safari | Full support (native `<table>`) |
| Edge | Full support (native `<table>`) |

## References

- Source: [W3C ARIA Authoring Practices Guide - Table Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/)
- MDN: [HTML table element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/table)
- MDN: [ARIA table role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/table_role)
- Related: [Grid Pattern](./aria-grid-pattern.md) - For interactive tabular data
