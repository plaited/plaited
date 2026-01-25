# ARIA Grid Pattern

## Overview

A grid widget is a container that enables users to navigate the information or interactive elements it contains using directional navigation keys such as arrow keys, Home, and End. As a generic container widget it offers flexible keyboard navigation and can serve a wide variety of needs.

**Key Characteristics:**

- **Composite widget**: Contains multiple focusable elements
- **Single tab stop**: Only one element in the grid is in the page tab sequence
- **Directional navigation**: Arrow keys move focus between cells
- **Two types**: Data grids (tabular information) and Layout grids (grouping widgets)
- **Focus management**: Author must provide code to manage focus movement

**Differences from Table Pattern:**

- Grid is a composite widget with single tab stop
- Table includes all focusable elements in tab sequence
- Grid requires custom focus management code
- Grid supports cell editing and selection

## Use Cases

### Data Grids

- Spreadsheet applications
- Editable data tables
- Sortable/filterable data views
- Multi-column data with interactive cells

### Layout Grids

- Navigation link groups
- Product card grids
- Message recipient lists
- Search result grids
- Widget groupings

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Data Grid -->
<div role="grid" aria-label="Products" aria-rowcount="100" aria-colcount="4">
  <div role="row">
    <div role="columnheader">Name</div>
    <div role="columnheader">Price</div>
    <div role="columnheader">Stock</div>
    <div role="columnheader">Actions</div>
  </div>
  <div role="row">
    <div role="gridcell" tabindex="0">Product 1</div>
    <div role="gridcell" tabindex="-1">$10.00</div>
    <div role="gridcell" tabindex="-1">50</div>
    <div role="gridcell" tabindex="-1">
      <button>Edit</button>
    </div>
  </div>
</div>
```

```javascript
// Grid navigation
const grid = document.querySelector('[role="grid"]')
grid.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault()
      moveToNextCell()
      break
    case 'ArrowLeft':
      e.preventDefault()
      moveToPreviousCell()
      break
    case 'ArrowDown':
      e.preventDefault()
      moveToCellBelow()
      break
    case 'ArrowUp':
      e.preventDefault()
      moveToCellAbove()
      break
  }
})

function moveFocus(cell) {
  cells.forEach(c => c.setAttribute('tabindex', '-1'))
  cell.setAttribute('tabindex', '0')
  cell.focus()
}
```

### Plaited Adaptation

**File Structure:**

```
grid/
  grid.css.ts        # Styles (createStyles) - ALWAYS separate
  grid.stories.tsx   # bElement + stories (imports from css.ts)
```

#### grid.css.ts

```typescript
// grid.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
})

export const styles = createStyles({
  grid: {
    display: 'table',
    inlineSize: '100%',
    borderCollapse: 'collapse',
  },
  row: {
    display: 'table-row',
  },
  header: {
    display: 'table-cell',
    padding: '0.5rem',
    fontWeight: 'bold',
    border: '1px solid #ccc',
    backgroundColor: '#f0f0f0',
    textAlign: 'left',
  },
  cell: {
    display: 'table-cell',
    padding: '0.5rem',
    border: '1px solid #ccc',
    backgroundColor: 'white',
    outline: 'none',
  },
  cellFocused: {
    backgroundColor: '#e3f2fd',
    boxShadow: 'inset 0 0 0 2px #007bff',
  },
  cellSelected: {
    backgroundColor: '#bbdefb',
  },
})

// Layout grid styles
export const layoutStyles = createStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '1rem',
  },
  cell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
    outline: 'none',
    cursor: 'pointer',
  },
  cellFocused: {
    borderColor: '#007bff',
    boxShadow: '0 0 0 2px rgba(0, 123, 255, 0.25)',
  },
})
```

#### grid.stories.tsx

```typescript
// grid.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, layoutStyles, hostStyles } from './grid.css.ts'

// Type for cell data
type CellData = {
  value: string | number
  editable?: boolean
}

type RowData = {
  id: string
  cells: CellData[]
}

// FunctionalTemplate for static grid - defined locally, NOT exported
const StaticGrid: FT<{
  label?: string
  headers: string[]
  rows: { id: string; cells: (string | number)[] }[]
}> = ({ label = 'Data grid', headers, rows }) => (
  <div role="grid" aria-label={label} {...styles.grid}>
    <div role="row" {...styles.row}>
      {headers.map((header, i) => (
        <div key={i} role="columnheader" {...styles.header}>
          {header}
        </div>
      ))}
    </div>
    {rows.map((row, rowIndex) => (
      <div key={row.id} role="row" aria-rowindex={rowIndex + 2} {...styles.row}>
        {row.cells.map((cell, colIndex) => (
          <div
            key={colIndex}
            role="gridcell"
            aria-colindex={colIndex + 1}
            tabIndex={rowIndex === 0 && colIndex === 0 ? 0 : -1}
            {...styles.cell}
          >
            {cell}
          </div>
        ))}
      </div>
    ))}
  </div>
)

// bElement for interactive data grid - defined locally, NOT exported
const DataGrid = bElement({
  tag: 'pattern-data-grid',
  observedAttributes: ['aria-label'],
  hostStyles,
  shadowDom: (
    <div
      p-target="grid"
      role="grid"
      aria-label="Data grid"
      p-trigger={{ keydown: 'handleKeydown' }}
      {...styles.grid}
    >
      <slot></slot>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const grid = $('grid')[0]
    let focusedRow = 0
    let focusedCol = 0

    const getCells = (): HTMLElement[][] => {
      const slot = grid?.querySelector('slot') as HTMLSlotElement
      if (!slot) return []
      const rows = slot.assignedElements().filter(
        (el) => el.getAttribute('role') === 'row'
      ) as HTMLElement[]
      return rows.map((row) =>
        Array.from(row.querySelectorAll('[role="gridcell"], [role="columnheader"]')) as HTMLElement[]
      )
    }

    const moveFocus = (rowIndex: number, colIndex: number) => {
      const cells = getCells()
      if (rowIndex < 0 || rowIndex >= cells.length) return
      if (colIndex < 0 || colIndex >= (cells[rowIndex]?.length ?? 0)) return

      // Remove tabindex from all cells
      cells.forEach((row) =>
        row.forEach((cell) => cell.setAttribute('tabindex', '-1'))
      )

      // Set tabindex on target cell
      const targetCell = cells[rowIndex]?.[colIndex]
      if (targetCell) {
        targetCell.setAttribute('tabindex', '0')
        targetCell.focus()
        focusedRow = rowIndex
        focusedCol = colIndex

        emit({
          type: 'cellFocus',
          detail: { row: rowIndex, col: colIndex },
        })
      }
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault()
            moveFocus(focusedRow, focusedCol + 1)
            break
          case 'ArrowLeft':
            event.preventDefault()
            moveFocus(focusedRow, focusedCol - 1)
            break
          case 'ArrowDown':
            event.preventDefault()
            moveFocus(focusedRow + 1, focusedCol)
            break
          case 'ArrowUp':
            event.preventDefault()
            moveFocus(focusedRow - 1, focusedCol)
            break
          case 'Home':
            event.preventDefault()
            if (event.ctrlKey) {
              moveFocus(0, 0)
            } else {
              moveFocus(focusedRow, 0)
            }
            break
          case 'End':
            event.preventDefault()
            const cells = getCells()
            if (event.ctrlKey) {
              const lastRow = cells.length - 1
              const lastCol = (cells[lastRow]?.length ?? 1) - 1
              moveFocus(lastRow, lastCol)
            } else {
              const lastCol = (cells[focusedRow]?.length ?? 1) - 1
              moveFocus(focusedRow, lastCol)
            }
            break
        }
      },
      onConnected() {
        // Initialize first cell as focusable
        const cells = getCells()
        if (cells[0]?.[0]) {
          cells[0][0].setAttribute('tabindex', '0')
        }
      },
    }
  },
})

// bElement for layout grid - defined locally, NOT exported
const LayoutGrid = bElement({
  tag: 'pattern-layout-grid',
  observedAttributes: ['aria-label', 'columns'],
  hostStyles,
  shadowDom: (
    <div
      p-target="grid"
      role="grid"
      aria-label="Navigation grid"
      p-trigger={{ keydown: 'handleKeydown' }}
      {...layoutStyles.grid}
    >
      <div role="row">
        <slot></slot>
      </div>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const grid = $('grid')[0]
    let focusedIndex = 0
    const columnsPerRow = parseInt(host.getAttribute('columns') ?? '3', 10)

    const getCells = (): HTMLElement[] => {
      const slot = grid?.querySelector('slot') as HTMLSlotElement
      if (!slot) return []
      return slot.assignedElements().filter(
        (el) => el.getAttribute('role') === 'gridcell'
      ) as HTMLElement[]
    }

    const moveFocus = (index: number) => {
      const cells = getCells()
      if (index < 0 || index >= cells.length) return

      cells.forEach((cell) => cell.setAttribute('tabindex', '-1'))
      cells[index].setAttribute('tabindex', '0')
      cells[index].focus()
      focusedIndex = index

      emit({ type: 'itemFocus', detail: { index } })
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        const cells = getCells()

        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault()
            moveFocus(Math.min(focusedIndex + 1, cells.length - 1))
            break
          case 'ArrowLeft':
            event.preventDefault()
            moveFocus(Math.max(focusedIndex - 1, 0))
            break
          case 'ArrowDown':
            event.preventDefault()
            moveFocus(Math.min(focusedIndex + columnsPerRow, cells.length - 1))
            break
          case 'ArrowUp':
            event.preventDefault()
            moveFocus(Math.max(focusedIndex - columnsPerRow, 0))
            break
          case 'Home':
            event.preventDefault()
            moveFocus(event.ctrlKey ? 0 : Math.floor(focusedIndex / columnsPerRow) * columnsPerRow)
            break
          case 'End':
            event.preventDefault()
            if (event.ctrlKey) {
              moveFocus(cells.length - 1)
            } else {
              const rowStart = Math.floor(focusedIndex / columnsPerRow) * columnsPerRow
              moveFocus(Math.min(rowStart + columnsPerRow - 1, cells.length - 1))
            }
            break
          case 'Enter':
          case ' ':
            event.preventDefault()
            emit({ type: 'itemActivate', detail: { index: focusedIndex } })
            break
        }
      },
      onConnected() {
        const cells = getCells()
        if (cells[0]) {
          cells[0].setAttribute('tabindex', '0')
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const basicDataGrid = story({
  intent: 'Display a data grid with keyboard navigation',
  template: () => (
    <DataGrid aria-label="Products">
      <div role="row" style="display: table-row;">
        <div role="columnheader" style="display: table-cell; padding: 0.5rem; border: 1px solid #ccc; font-weight: bold;">Name</div>
        <div role="columnheader" style="display: table-cell; padding: 0.5rem; border: 1px solid #ccc; font-weight: bold;">Price</div>
        <div role="columnheader" style="display: table-cell; padding: 0.5rem; border: 1px solid #ccc; font-weight: bold;">Stock</div>
      </div>
      <div role="row" aria-rowindex={2} style="display: table-row;">
        <div role="gridcell" tabIndex={0} style="display: table-cell; padding: 0.5rem; border: 1px solid #ccc;">Product A</div>
        <div role="gridcell" tabIndex={-1} style="display: table-cell; padding: 0.5rem; border: 1px solid #ccc;">$10.00</div>
        <div role="gridcell" tabIndex={-1} style="display: table-cell; padding: 0.5rem; border: 1px solid #ccc;">50</div>
      </div>
      <div role="row" aria-rowindex={3} style="display: table-row;">
        <div role="gridcell" tabIndex={-1} style="display: table-cell; padding: 0.5rem; border: 1px solid #ccc;">Product B</div>
        <div role="gridcell" tabIndex={-1} style="display: table-cell; padding: 0.5rem; border: 1px solid #ccc;">$25.00</div>
        <div role="gridcell" tabIndex={-1} style="display: table-cell; padding: 0.5rem; border: 1px solid #ccc;">30</div>
      </div>
    </DataGrid>
  ),
  play: async ({ findByAttribute, assert }) => {
    const grid = await findByAttribute('p-target', 'grid')

    assert({
      given: 'grid is rendered',
      should: 'have grid role',
      actual: grid?.getAttribute('role'),
      expected: 'grid',
    })
  },
})

export const layoutGridNavigation = story({
  intent: 'Display a layout grid for navigation with keyboard support',
  template: () => (
    <LayoutGrid aria-label="Quick actions" columns="3">
      <div role="gridcell" tabIndex={0} style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px; text-align: center;">Home</div>
      <div role="gridcell" tabIndex={-1} style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px; text-align: center;">Products</div>
      <div role="gridcell" tabIndex={-1} style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px; text-align: center;">About</div>
      <div role="gridcell" tabIndex={-1} style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px; text-align: center;">Contact</div>
      <div role="gridcell" tabIndex={-1} style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px; text-align: center;">Help</div>
      <div role="gridcell" tabIndex={-1} style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px; text-align: center;">Settings</div>
    </LayoutGrid>
  ),
  play: async ({ findByAttribute, assert }) => {
    const grid = await findByAttribute('p-target', 'grid')

    assert({
      given: 'layout grid is rendered',
      should: 'have grid role',
      actual: grid?.getAttribute('role'),
      expected: 'grid',
    })

    const cells = grid?.querySelectorAll('[role="gridcell"]')
    assert({
      given: 'layout grid has cells',
      should: 'have 6 cells',
      actual: cells?.length,
      expected: 6,
    })
  },
})

export const staticGridDisplay = story({
  intent: 'Static FunctionalTemplate grid for non-interactive display',
  template: () => (
    <StaticGrid
      label="Inventory"
      headers={['Item', 'Quantity', 'Location']}
      rows={[
        { id: '1', cells: ['Widget', 100, 'Warehouse A'] },
        { id: '2', cells: ['Gadget', 50, 'Warehouse B'] },
        { id: '3', cells: ['Gizmo', 75, 'Warehouse A'] },
      ]}
    />
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - grids are bElements with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`
- **Requires external web API**: Focus management APIs
- **Cleanup required**: No

## Keyboard Interaction

### Data Grid Keys

- **Arrow Keys**: Move focus one cell in that direction
- **Page Down/Up**: Move focus multiple rows
- **Home**: First cell in row (Ctrl+Home: first cell in grid)
- **End**: Last cell in row (Ctrl+End: last cell in grid)
- **Enter/F2**: Enter edit mode for editable cells
- **Escape**: Exit edit mode

### Layout Grid Keys

- **Arrow Keys**: Move focus (may wrap between rows/columns)
- **Home**: First cell in row (Ctrl+Home: first cell in grid)
- **End**: Last cell in row (Ctrl+End: last cell in grid)
- **Enter/Space**: Activate focused item

## WAI-ARIA Roles, States, and Properties

### Required

- **role="grid"**: Container element
- **role="row"**: Row container
- **role="gridcell"**: Data cell
- **role="columnheader"**: Column header cell
- **role="rowheader"**: Row header cell (optional)

### Optional

- **aria-label** or **aria-labelledby**: Accessible label for grid
- **aria-rowcount**: Total number of rows
- **aria-colcount**: Total number of columns
- **aria-rowindex**: Position of row within grid
- **aria-colindex**: Position of cell within row
- **aria-selected**: `"true"` on selected cells/rows/columns
- **aria-readonly**: `"true"` on read-only cells or grid

## Best Practices

1. **Use bElement** - Grids require complex state and focus management
2. **Use spread syntax** - `{...styles.x}` for applying styles
3. **Single tab stop** - Only one cell should have `tabindex="0"` at a time
4. **Focus on widget** - If cell contains single widget (button, link), focus the widget
5. **Focus on cell** - If cell contains text/graphic, focus the cell
6. **Update tabindex** - Move `tabindex="0"` as focus moves
7. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers use application mode with grids
- Only focusable elements are announced in application mode
- Cell content must be focusable or used to label focusable elements
- Focus movement should trigger visual scrolling
- Grid structure (rows, columns) should be programmatically determinable

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- Related: [Table Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/)
- MDN: [ARIA grid role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/grid_role)
- MDN: [ARIA gridcell role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/gridcell_role)
