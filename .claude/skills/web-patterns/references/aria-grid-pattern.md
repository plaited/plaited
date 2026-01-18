# ARIA Grid Pattern

## Overview

A grid widget is a container that enables users to navigate the information or interactive elements it contains using directional navigation keys such as arrow keys, Home, and End. As a generic container widget it offers flexible keyboard navigation and can serve a wide variety of needs. It can be used for simple use cases like grouping a collection of checkboxes or navigation links or for much more complex applications such as creating a full-featured spreadsheet.

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

<!-- Layout Grid -->
<div role="grid" aria-label="Navigation">
  <div role="row">
    <div role="gridcell" tabindex="0">
      <a href="/home">Home</a>
    </div>
    <div role="gridcell" tabindex="-1">
      <a href="/about">About</a>
    </div>
  </div>
</div>
```

```javascript
// Grid navigation
const grid = document.querySelector('[role="grid"]')
const cells = grid.querySelectorAll('[role="gridcell"], [role="columnheader"], [role="rowheader"]')

grid.addEventListener('keydown', (e) => {
  const currentCell = e.target
  const currentIndex = Array.from(cells).indexOf(currentCell)
  const row = currentCell.closest('[role="row"]')
  const rowCells = Array.from(row.querySelectorAll('[role="gridcell"], [role="columnheader"], [role="rowheader"]'))
  const rowIndex = Array.from(grid.querySelectorAll('[role="row"]')).indexOf(row)
  
  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault()
      const nextInRow = rowCells[rowCells.indexOf(currentCell) + 1]
      if (nextInRow) {
        moveFocus(nextInRow)
      }
      break
    case 'ArrowLeft':
      e.preventDefault()
      const prevInRow = rowCells[rowCells.indexOf(currentCell) - 1]
      if (prevInRow) {
        moveFocus(prevInRow)
      }
      break
    case 'ArrowDown':
      e.preventDefault()
      moveToCellBelow(currentCell, rowIndex)
      break
    case 'ArrowUp':
      e.preventDefault()
      moveToCellAbove(currentCell, rowIndex)
      break
  }
})

function moveFocus(cell) {
  // Remove tabindex from all cells
  cells.forEach(c => c.setAttribute('tabindex', '-1'))
  // Set tabindex on target cell
  cell.setAttribute('tabindex', '0')
  cell.focus()
}
```

### Plaited Adaptation

**Important**: In Plaited, grids are implemented as **bElements** because they require:

- Complex state management (cell positions, selection, editing state)
- Focus management (single tab stop, directional navigation)
- Keyboard event handling (arrow keys, Home, End, Page Up/Down)
- Cell content management (editing, widgets)

#### Data Grid (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

type CellData = {
  value: string | number
  editable?: boolean
  type?: 'text' | 'number' | 'button'
}

type RowData = {
  id: string
  cells: CellData[]
}

const gridStyles = createStyles({
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
  },
  cell: {
    display: 'table-cell',
    padding: '0.5rem',
    border: '1px solid #ccc',
    backgroundColor: {
      $default: 'white',
      '[aria-selected="true"]': '#e3f2fd',
      ':focus': '#bbdefb',
    },
  },
  input: {
    inlineSize: '100%',
    border: 'none',
    background: 'transparent',
    padding: 0,
  },
})

type DataGridEvents = {
  cellFocus: { row: number; col: number; value: string | number }
  cellEdit: { row: number; col: number; value: string | number }
  cellSelect: { row: number; col: number }
}

export const DataGrid = bElement<DataGridEvents>({
  tag: 'data-grid',
  shadowDom: (
    <div
      p-target='grid'
      role='grid'
      aria-label='Data grid'
      {...gridStyles.grid}
      p-trigger={{ keydown: 'handleKeydown' }}
    >
      {/* Rows will be dynamically rendered */}
    </div>
  ),
  bProgram({ $, host, emit }) {
    const grid = $('grid')[0]
    let rows: RowData[] = []
    let focusedRow = 0
    let focusedCol = 0
    let isEditing = false
    let selectedCells = new Set<string>()

    const getCellElement = (rowIndex: number, colIndex: number) => {
      const rowElement = grid?.querySelectorAll('[role="row"]')[rowIndex] as HTMLElement
      if (!rowElement) return null
      const cells = rowElement.querySelectorAll('[role="gridcell"], [role="columnheader"]')
      return cells[colIndex] as HTMLElement
    }

    const moveFocus = (rowIndex: number, colIndex: number) => {
      if (rowIndex < 0 || rowIndex >= rows.length) return
      if (colIndex < 0 || colIndex >= rows[rowIndex]?.cells.length) return
      
      // Remove tabindex from all cells
      const allCells = grid?.querySelectorAll('[role="gridcell"], [role="columnheader"], [role="rowheader"]')
      allCells?.forEach((cell) => {
        (cell as HTMLElement).setAttribute('tabindex', '-1')
      })
      
      const targetCell = getCellElement(rowIndex, colIndex)
      if (targetCell) {
        targetCell.setAttribute('tabindex', '0')
        targetCell.focus()
        focusedRow = rowIndex
        focusedCol = colIndex
        
        const cellData = rows[rowIndex]?.cells[colIndex]
        if (cellData) {
          emit({
            type: 'cellFocus',
            detail: { row: rowIndex, col: colIndex, value: cellData.value },
          })
        }
      }
    }

    const renderGrid = () => {
      if (!grid) return
      
      const headerRow = rows[0]
      if (!headerRow) return
      
      grid.render(
        <div role='row'>
          {headerRow.cells.map((cell, colIndex) => (
            <div
              key={colIndex}
              role='columnheader'
              {...gridStyles.header}
              tabIndex={colIndex === 0 ? 0 : -1}
              p-trigger={{ focus: 'handleCellFocus' }}
              data-row='0'
              data-col={String(colIndex)}
            >
              {cell.value}
            </div>
          ))}
        </div>,
        ...rows.slice(1).map((row, rowIndex) => (
          <div
            key={row.id}
            role='row'
            aria-rowindex={rowIndex + 2}
          >
            {row.cells.map((cell, colIndex) => {
              const cellId = `${rowIndex + 1}-${colIndex}`
              const isFocused = rowIndex + 1 === focusedRow && colIndex === focusedCol
              const isSelected = selectedCells.has(cellId)
              
              return (
                <div
                  key={colIndex}
                  role='gridcell'
                  aria-colindex={colIndex + 1}
                  aria-selected={isSelected ? 'true' : undefined}
                  tabIndex={isFocused ? 0 : -1}
                  {...gridStyles.cell}
                  p-trigger={{ focus: 'handleCellFocus', click: 'handleCellClick' }}
                  data-row={String(rowIndex + 1)}
                  data-col={String(colIndex)}
                  data-cell-id={cellId}
                >
                  {cell.editable && isEditing && isFocused ? (
                    <input
                      type={cell.type || 'text'}
                      value={String(cell.value)}
                      p-trigger={{ input: 'handleCellInput', blur: 'handleCellBlur', keydown: 'handleCellKeydown' }}
                      {...gridStyles.input}
                      autoFocus
                    />
                  ) : (
                    cell.value
                  )}
                </div>
              )
            })}
          </div>
        ))
      )
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        if (isEditing) return // Let cell handle editing keys
        
        const currentCell = event.target as HTMLElement
        const rowIndex = parseInt(currentCell.getAttribute('data-row') || '0', 10)
        const colIndex = parseInt(currentCell.getAttribute('data-col') || '0', 10)
        
        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault()
            moveFocus(rowIndex, colIndex + 1)
            break
          case 'ArrowLeft':
            event.preventDefault()
            moveFocus(rowIndex, colIndex - 1)
            break
          case 'ArrowDown':
            event.preventDefault()
            moveFocus(rowIndex + 1, colIndex)
            break
          case 'ArrowUp':
            event.preventDefault()
            moveFocus(rowIndex - 1, colIndex)
            break
          case 'Home':
            event.preventDefault()
            if (event.ctrlKey) {
              moveFocus(1, 0) // First cell
            } else {
              moveFocus(rowIndex, 0) // First cell in row
            }
            break
          case 'End':
            event.preventDefault()
            if (event.ctrlKey) {
              const lastRow = rows.length - 1
              const lastCol = rows[lastRow]?.cells.length - 1 || 0
              moveFocus(lastRow, lastCol)
            } else {
              const lastCol = rows[rowIndex]?.cells.length - 1 || 0
              moveFocus(rowIndex, lastCol)
            }
            break
          case 'PageDown':
            event.preventDefault()
            moveFocus(Math.min(rowIndex + 10, rows.length - 1), colIndex)
            break
          case 'PageUp':
            event.preventDefault()
            moveFocus(Math.max(rowIndex - 10, 1), colIndex)
            break
          case 'Enter':
          case 'F2':
            event.preventDefault()
            if (rows[rowIndex]?.cells[colIndex]?.editable) {
              isEditing = true
              renderGrid()
            }
            break
          case 'Escape':
            event.preventDefault()
            isEditing = false
            renderGrid()
            break
        }
      },
      handleCellFocus(event: { target: HTMLElement }) {
        const cell = event.target
        const rowIndex = parseInt(cell.getAttribute('data-row') || '0', 10)
        const colIndex = parseInt(cell.getAttribute('data-col') || '0', 10)
        focusedRow = rowIndex
        focusedCol = colIndex
      },
      handleCellClick(event: { target: HTMLElement }) {
        const cell = event.target
        const cellId = cell.getAttribute('data-cell-id')
        if (cellId) {
          if (selectedCells.has(cellId)) {
            selectedCells.delete(cellId)
          } else {
            selectedCells.add(cellId)
          }
          renderGrid()
        }
      },
      handleCellInput(event: { target: HTMLInputElement }) {
        const input = event.target
        const cell = input.closest('[role="gridcell"]') as HTMLElement
        const rowIndex = parseInt(cell.getAttribute('data-row') || '0', 10)
        const colIndex = parseInt(cell.getAttribute('data-col') || '0', 10)
        
        const newValue = input.value
        if (rows[rowIndex]?.cells[colIndex]) {
          rows[rowIndex].cells[colIndex].value = newValue
        }
      },
      handleCellBlur() {
        isEditing = false
        renderGrid()
      },
      handleCellKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault()
          isEditing = false
          renderGrid()
        }
      },
      setData(newRows: RowData[]) {
        rows = newRows
        renderGrid()
      },
      onConnected() {
        // Initialize grid with data
        // Could come from attribute, slot, or external source
      },
    }
  },
})
```

#### Layout Grid (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const layoutGridStyles = createStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem',
  },
  cell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: {
      $default: 'white',
      ':focus': '#e3f2fd',
    },
  },
})

type LayoutGridEvents = {
  itemFocus: { index: number }
  itemActivate: { index: number }
}

export const LayoutGrid = bElement<LayoutGridEvents>({
  tag: 'layout-grid',
  shadowDom: (
    <div
      p-target='grid'
      role='grid'
      aria-label='Navigation grid'
      {...layoutGridStyles.grid}
      p-trigger={{ keydown: 'handleKeydown' }}
    >
      <slot></slot>
    </div>
  ),
  bProgram({ $, emit }) {
    const grid = $('grid')[0]
    let items: HTMLElement[] = []
    let focusedIndex = 0

    const getItems = () => {
      if (!grid) return []
      return Array.from(
        grid.querySelectorAll('[role="gridcell"]')
      ) as HTMLElement[]
    }

    const moveFocus = (index: number, wrap = true) => {
      items = getItems()
      if (items.length === 0) return
      
      let targetIndex = index
      if (wrap) {
        if (targetIndex < 0) targetIndex = items.length - 1
        if (targetIndex >= items.length) targetIndex = 0
      } else {
        targetIndex = Math.max(0, Math.min(targetIndex, items.length - 1))
      }
      
      // Remove tabindex from all items
      items.forEach((item) => item.setAttribute('tabindex', '-1'))
      
      // Set tabindex on target
      items[targetIndex].setAttribute('tabindex', '0')
      items[targetIndex].focus()
      focusedIndex = targetIndex
      
      emit({ type: 'itemFocus', detail: { index: targetIndex } })
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        items = getItems()
        const currentIndex = items.indexOf(event.target as HTMLElement)
        if (currentIndex === -1) return
        
        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault()
            // Layout grids can wrap
            moveFocus(currentIndex + 1, true)
            break
          case 'ArrowLeft':
            event.preventDefault()
            moveFocus(currentIndex - 1, true)
            break
          case 'ArrowDown':
            event.preventDefault()
            // Calculate next row (assuming 3 columns for example)
            const colsPerRow = 3
            const nextRowIndex = currentIndex + colsPerRow
            moveFocus(nextRowIndex, true)
            break
          case 'ArrowUp':
            event.preventDefault()
            const prevRowIndex = currentIndex - colsPerRow
            moveFocus(prevRowIndex, true)
            break
          case 'Home':
            event.preventDefault()
            if (event.ctrlKey) {
              moveFocus(0, false)
            } else {
              // First item in current row
              const rowStart = Math.floor(currentIndex / 3) * 3
              moveFocus(rowStart, false)
            }
            break
          case 'End':
            event.preventDefault()
            if (event.ctrlKey) {
              moveFocus(items.length - 1, false)
            } else {
              // Last item in current row
              const rowStart = Math.floor(currentIndex / 3) * 3
              const rowEnd = Math.min(rowStart + 2, items.length - 1)
              moveFocus(rowEnd, false)
            }
            break
          case 'Enter':
          case ' ':
            event.preventDefault()
            emit({ type: 'itemActivate', detail: { index: currentIndex } })
            break
        }
      },
      onConnected() {
        // Initialize items from slot
        const slot = grid?.querySelector('slot') as HTMLSlotElement
        if (slot) {
          slot.addEventListener('slotchange', () => {
            items = getItems()
            // Set first item as focusable
            if (items.length > 0) {
              items[0].setAttribute('tabindex', '0')
              items.slice(1).forEach((item) => item.setAttribute('tabindex', '-1'))
            }
          })
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - grids are bElements with Shadow DOM
- **Uses bElement built-ins**: 
  - `p-trigger` for keyboard events, focus events, clicks
  - `p-target` for element selection with `$()`
  - `render()` helper for dynamic grid rendering
  - `attr()` helper for managing ARIA attributes and tabindex
  - `observedAttributes` for reactive updates (optional)
- **Requires external web API**: 
  - Focus management APIs (`focus()`, `tabindex`)
  - Keyboard event handling
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

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
- **Page Down/Up**: Move focus multiple rows (optional)
- **Home**: First cell in row (Ctrl+Home: first cell in grid)
- **End**: Last cell in row (Ctrl+End: last cell in grid)
- **Enter/Space**: Activate focused item

### Selection Keys (Optional)

- **Ctrl+Space**: Select column
- **Shift+Space**: Select row
- **Ctrl+A**: Select all
- **Shift+Arrow**: Extend selection

## WAI-ARIA Roles, States, and Properties

### Required

- **role="grid"**: Container element
- **role="row"**: Row container
- **role="gridcell"**: Data cell
- **role="columnheader"**: Column header cell
- **role="rowheader"**: Row header cell (optional)

### Optional

- **aria-label** or **aria-labelledby**: Accessible label for grid
- **aria-describedby**: Description of grid
- **aria-rowcount**: Total number of rows
- **aria-colcount**: Total number of columns
- **aria-rowindex**: Position of row within grid
- **aria-colindex**: Position of cell within row
- **aria-selected**: `"true"` on selected cells/rows/columns
- **aria-readonly**: `"true"` on read-only cells or grid
- **aria-sort**: Sort state on column headers

## Best Practices

1. **Use bElement** - Grids require complex state and focus management
2. **Single tab stop** - Only one cell should have `tabindex="0"` at a time
3. **Focus on widget** - If cell contains single widget (button, link), focus the widget
4. **Focus on cell** - If cell contains text/graphic, focus the cell
5. **Handle editing** - Provide Enter/F2 to enter edit mode, Escape to exit
6. **Update tabindex** - Move `tabindex="0"` as focus moves
7. **Scroll into view** - Ensure focused cell is visible
8. **Support selection** - Use `aria-selected` for selected cells
9. **Document keyboard shortcuts** - Grid navigation may not be obvious
10. **Consider layout vs data** - Different navigation patterns for each type

## Accessibility Considerations

- Screen readers use application mode with grids
- Only focusable elements are announced in application mode
- Cell content must be focusable or used to label focusable elements
- Focus movement should trigger visual scrolling
- Selected cells should be clearly indicated
- Grid structure (rows, columns) should be programmatically determinable

## Differences: Data Grid vs Layout Grid

| Feature | Data Grid | Layout Grid |
|---------|-----------|-------------|
| Purpose | Tabular information | Grouping widgets |
| Headers | Usually has column/row headers | May not have headers |
| Wrapping | No wrapping | May wrap (Right→next row) |
| Selection | Common | Unusual |
| Editing | Common | Rare |
| Structure | Strict rows/columns | Flexible layout |

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA grid roles and attributes have universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- Related: [Table Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/)
- MDN: [ARIA grid role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/grid_role)
- MDN: [ARIA gridcell role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/gridcell_role)
