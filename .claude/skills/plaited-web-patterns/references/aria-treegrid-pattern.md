# ARIA Treegrid Pattern

## Overview

A treegrid widget presents a hierarchical data grid consisting of tabular information that is editable or interactive. Any row in the hierarchy may have child rows, and rows with children may be expanded or collapsed to show or hide the children. For example, in a `treegrid` used to display messages and message responses for an e-mail discussion list, messages with responses would be in rows that can be expanded to reveal the response messages.

**Key Characteristics:**
- **Hierarchical grid**: Combines tree view hierarchy with tabular grid structure
- **Expand/collapse rows**: Parent rows can be expanded or collapsed to show/hide child rows
- **Focusable rows and cells**: Both rows and cells are focusable (unlike tree view where only nodes are focusable)
- **Keyboard navigation**: Complex navigation supporting rows-first, cells-first, or cells-only modes
- **Selection**: Single-select or multi-select modes for rows or cells
- **Editable cells**: Cells can contain editable or interactive content

**Important Notes:**
- Both rows and cells must be focusable (except non-functional column headers)
- Screen readers use application mode, so only focusable elements are announced
- Focus and selection are distinct - visual design must distinguish them
- Navigation modes: rows-first, cells-first, or cells-only
- All cells should be focusable or contain focusable elements

**Differences from Tree View:**
- Treegrid: Both rows and cells are focusable, tabular structure
- Tree View: Only nodes are focusable, list structure

**Differences from Grid:**
- Treegrid: Hierarchical rows with expand/collapse
- Grid: Flat structure, no hierarchy

## Use Cases

- E-mail inbox with threaded conversations
- File system with file details (size, date, type)
- Project management with task hierarchies
- Financial data with category breakdowns
- Organizational charts with employee details
- Product catalogs with category hierarchies
- Comment threads with nested replies
- Budget tracking with category/subcategory breakdowns

## Implementation

### Vanilla JavaScript

```html
<!-- Treegrid -->
<table role="treegrid" aria-label="E-mail Inbox">
  <thead>
    <tr role="row">
      <th role="columnheader">Subject</th>
      <th role="columnheader">From</th>
      <th role="columnheader">Date</th>
    </tr>
  </thead>
  <tbody>
    <tr role="row" aria-expanded="true" aria-level="1">
      <td role="gridcell" tabindex="0">Project Update</td>
      <td role="gridcell" tabindex="-1">john@example.com</td>
      <td role="gridcell" tabindex="-1">2024-01-15</td>
    </tr>
    <tr role="row" aria-level="2" aria-posinset="1" aria-setsize="2">
      <td role="gridcell" tabindex="-1">Re: Project Update</td>
      <td role="gridcell" tabindex="-1">jane@example.com</td>
      <td role="gridcell" tabindex="-1">2024-01-16</td>
    </tr>
  </tbody>
</table>
```

```javascript
// Treegrid implementation
const treegrid = document.querySelector('[role="treegrid"]')
let focusedRow = 0
let focusedCol = 0
let selectedCells = new Set()

// Get all visible rows
function getVisibleRows() {
  return Array.from(treegrid.querySelectorAll('[role="row"]:not([hidden])')) as HTMLElement[]
}

// Get cells in a row
function getCellsInRow(row: HTMLElement) {
  return Array.from(row.querySelectorAll('[role="gridcell"], [role="rowheader"]')) as HTMLElement[]
}

// Expand/collapse row
function toggleRow(row: HTMLElement) {
  const isExpanded = row.getAttribute('aria-expanded') === 'true'
  const childRows = getChildRows(row)
  childRows.forEach(child => {
    child.hidden = isExpanded
  })
  row.setAttribute('aria-expanded', !isExpanded)
}

// Get child rows
function getChildRows(parentRow: HTMLElement) {
  const parentLevel = parseInt(parentRow.getAttribute('aria-level') || '1', 10)
  const rows = getVisibleRows()
  const parentIndex = rows.indexOf(parentRow)
  const children: HTMLElement[] = []
  
  for (let i = parentIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const level = parseInt(row.getAttribute('aria-level') || '1', 10)
    if (level > parentLevel) {
      children.push(row)
    } else {
      break
    }
  }
  
  return children
}

// Keyboard navigation
treegrid.addEventListener('keydown', (e) => {
  const rows = getVisibleRows()
  const currentRow = rows[focusedRow]
  const cells = getCellsInRow(currentRow)
  const currentCell = cells[focusedCol]
  
  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault()
      if (currentRow.getAttribute('aria-expanded') === 'false') {
        toggleRow(currentRow)
      } else if (focusedCol < cells.length - 1) {
        focusedCol++
        updateFocus()
      }
      break
      
    case 'ArrowLeft':
      e.preventDefault()
      if (currentRow.getAttribute('aria-expanded') === 'true') {
        toggleRow(currentRow)
      } else if (focusedCol > 0) {
        focusedCol--
        updateFocus()
      }
      break
      
    case 'ArrowDown':
      e.preventDefault()
      if (focusedRow < rows.length - 1) {
        focusedRow++
        if (focusedCol >= getCellsInRow(rows[focusedRow]).length) {
          focusedCol = getCellsInRow(rows[focusedRow]).length - 1
        }
        updateFocus()
      }
      break
      
    case 'ArrowUp':
      e.preventDefault()
      if (focusedRow > 0) {
        focusedRow--
        if (focusedCol >= getCellsInRow(rows[focusedRow]).length) {
          focusedCol = getCellsInRow(rows[focusedRow]).length - 1
        }
        updateFocus()
      }
      break
  }
})

function updateFocus() {
  const rows = getVisibleRows()
  const cells = getCellsInRow(rows[focusedRow])
  
  // Remove tabindex from all cells
  treegrid.querySelectorAll('[role="gridcell"], [role="rowheader"]').forEach(cell => {
    (cell as HTMLElement).setAttribute('tabindex', '-1')
  })
  
  // Set tabindex on focused cell
  if (cells[focusedCol]) {
    cells[focusedCol].setAttribute('tabindex', '0')
    cells[focusedCol].focus()
  }
}
```

### Plaited Adaptation

**Important**: In Plaited, treegrids are implemented as **bElements** because they require complex state management (hierarchical structure, expand/collapse, focus on rows/cells, selection, keyboard navigation).

#### Treegrid (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const treegridStyles = createStyles({
  treegrid: {
    display: 'table',
    width: '100%',
    borderCollapse: 'collapse',
    border: '1px solid #ccc',
  },
  row: {
    display: 'table-row',
    '&[data-focused="true"]': {
      backgroundColor: '#e0e0e0',
      outline: '2px solid #007bff',
    },
    '&[aria-selected="true"]': {
      backgroundColor: '#b3d9ff',
    },
  },
  cell: {
    display: 'table-cell',
    padding: '0.5rem',
    border: '1px solid #e0e0e0',
    '&[data-focused="true"]': {
      outline: '2px solid #007bff',
    },
    '&[aria-selected="true"]': {
      backgroundColor: '#d0e8ff',
    },
  },
  expandIcon: {
    display: 'inline-block',
    width: '1rem',
    textAlign: 'center',
    marginRight: '0.5rem',
    userSelect: 'none',
  },
})

type TreegridRow = {
  id: string
  cells: (string | number)[]
  children?: TreegridRow[]
}

type TreegridEvents = {
  cellFocus: { row: number; col: number; value: unknown }
  rowSelect: { row: number; selected: boolean }
  rowExpand: { row: number; expanded: boolean }
}

export const Treegrid = bElement<TreegridEvents>({
  tag: 'accessible-treegrid',
  observedAttributes: ['data', 'aria-label', 'aria-multiselectable', 'navigation-mode'],
  formAssociated: true,
  shadowDom: (
    <table
      p-target='treegrid'
      role='treegrid'
      tabIndex={0}
      {...treegridStyles.treegrid}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus', blur: 'handleBlur' }}
    >
      <thead p-target='thead'>
        <slot name='headers'></slot>
      </thead>
      <tbody p-target='tbody'></tbody>
    </table>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const treegrid = $('treegrid')[0]
    const thead = $('thead')[0]
    const tbody = $('tbody')[0]
    let rows: HTMLElement[] = []
    let focusedRow = 0
    let focusedCol = 0
    let selectedRows = new Set<number>()
    let expandedRows = new Set<number>()
    let treegridData: TreegridRow[] = []
    const isMultiSelect = host.getAttribute('aria-multiselectable') === 'true'
    const navigationMode = host.getAttribute('navigation-mode') || 'cells-only' // 'rows-first', 'cells-first', 'cells-only'
    
    const getVisibleRows = (): HTMLElement[] => {
      return Array.from(tbody?.querySelectorAll('[role="row"]:not([hidden])') || []) as HTMLElement[]
    }
    
    const getCellsInRow = (row: HTMLElement): HTMLElement[] => {
      return Array.from(row.querySelectorAll('[role="gridcell"], [role="rowheader"]')) as HTMLElement[]
    }
    
    const getChildRows = (parentIndex: number): number[] => {
      const visibleRows = getVisibleRows()
      if (parentIndex < 0 || parentIndex >= visibleRows.length) return []
      
      const parentRow = visibleRows[parentIndex]
      const parentLevel = parseInt(parentRow.getAttribute('aria-level') || '1', 10)
      const children: number[] = []
      
      for (let i = parentIndex + 1; i < visibleRows.length; i++) {
        const row = visibleRows[i]
        const level = parseInt(row.getAttribute('aria-level') || '1', 10)
        if (level > parentLevel) {
          children.push(i)
        } else {
          break
        }
      }
      
      return children
    }
    
    const isRowExpanded = (rowIndex: number): boolean => {
      return expandedRows.has(rowIndex)
    }
    
    const hasChildren = (rowIndex: number): boolean => {
      return getChildRows(rowIndex).length > 0
    }
    
    const expandRow = (rowIndex: number) => {
      const childRows = getChildRows(rowIndex)
      const visibleRows = getVisibleRows()
      
      childRows.forEach(childIndex => {
        visibleRows[childIndex].removeAttribute('hidden')
      })
      
      expandedRows.add(rowIndex)
      visibleRows[rowIndex].setAttribute('aria-expanded', 'true')
      
      emit({ type: 'rowExpand', detail: { row: rowIndex, expanded: true } })
    }
    
    const collapseRow = (rowIndex: number) => {
      const childRows = getChildRows(rowIndex)
      const visibleRows = getVisibleRows()
      
      childRows.forEach(childIndex => {
        visibleRows[childIndex].setAttribute('hidden', '')
      })
      
      expandedRows.delete(rowIndex)
      visibleRows[rowIndex].setAttribute('aria-expanded', 'false')
      
      emit({ type: 'rowExpand', detail: { row: rowIndex, expanded: false } })
    }
    
    const toggleRow = (rowIndex: number) => {
      if (isRowExpanded(rowIndex)) {
        collapseRow(rowIndex)
      } else {
        expandRow(rowIndex)
      }
    }
    
    const updateFocus = () => {
      const visibleRows = getVisibleRows()
      if (visibleRows.length === 0) return
      
      // Clamp focused row/col
      if (focusedRow >= visibleRows.length) {
        focusedRow = visibleRows.length - 1
      }
      
      const cells = getCellsInRow(visibleRows[focusedRow])
      if (cells.length === 0) return
      
      if (focusedCol >= cells.length) {
        focusedCol = cells.length - 1
      }
      
      // Remove tabindex from all cells
      tbody?.querySelectorAll('[role="gridcell"], [role="rowheader"]').forEach(cell => {
        (cell as HTMLElement).setAttribute('tabindex', '-1')
        cell.removeAttribute('data-focused')
      })
      
      // Set focus on target cell
      const targetCell = cells[focusedCol]
      if (targetCell) {
        targetCell.setAttribute('tabindex', '0')
        targetCell.setAttribute('data-focused', 'true')
        targetCell.focus()
        
        // Also mark row as focused
        visibleRows.forEach((row, idx) => {
          row.setAttribute('data-focused', idx === focusedRow ? 'true' : 'false')
        })
        
        const rowData = findRowData(focusedRow)
        if (rowData) {
          emit({
            type: 'cellFocus',
            detail: {
              row: focusedRow,
              col: focusedCol,
              value: rowData.cells[focusedCol],
            },
          })
        }
      }
    }
    
    const findRowData = (rowIndex: number): TreegridRow | null => {
      // This would need to map visible row index to actual data
      // Simplified for example
      return treegridData[rowIndex] || null
    }
    
    const selectRow = (rowIndex: number, toggle = false) => {
      const visibleRows = getVisibleRows()
      if (rowIndex < 0 || rowIndex >= visibleRows.length) return
      
      const row = visibleRows[rowIndex]
      
      if (isMultiSelect) {
        if (toggle) {
          if (selectedRows.has(rowIndex)) {
            selectedRows.delete(rowIndex)
            row.setAttribute('aria-selected', 'false')
          } else {
            selectedRows.add(rowIndex)
            row.setAttribute('aria-selected', 'true')
          }
        } else {
          selectedRows.add(rowIndex)
          row.setAttribute('aria-selected', 'true')
        }
      } else {
        // Single-select: unselect all others
        selectedRows.forEach(idx => {
          visibleRows[idx].setAttribute('aria-selected', 'false')
        })
        selectedRows.clear()
        selectedRows.add(rowIndex)
        row.setAttribute('aria-selected', 'true')
      }
      
      emit({
        type: 'rowSelect',
        detail: { row: rowIndex, selected: selectedRows.has(rowIndex) },
      })
      
      updateFormValue()
    }
    
    const updateFormValue = () => {
      const selected = Array.from(selectedRows)
      if (isMultiSelect) {
        internals.setFormValue(JSON.stringify(selected))
      } else {
        internals.setFormValue(selected[0]?.toString() || '')
      }
    }
    
    const renderTreegrid = () => {
      if (!tbody) return
      
      const allRows: HTMLElement[] = []
      const parentExpandedStack: boolean[] = [] // Track parent expansion state by level
      
      const renderRow = (rowData: TreegridRow, level = 1, rowIndex = 0): number => {
        const hasChildren = rowData.children && rowData.children.length > 0
        const isExpanded = expandedRows.has(rowIndex)
        const isParentExpanded = level === 1 || parentExpandedStack[level - 2] === true
        const isHidden = level > 1 && !isParentExpanded
        
        // Update parent expansion stack
        parentExpandedStack[level - 1] = isExpanded
        
        const row = (
          <tr
            role='row'
            aria-level={level}
            data-row-index={rowIndex}
            hidden={isHidden}
            {...treegridStyles.row}
            p-trigger={{ click: 'handleRowClick' }}
          >
            {rowData.cells.map((cellValue, colIndex) => {
              const isFirstCell = colIndex === 0
              const isFocused = rowIndex === focusedRow && colIndex === focusedCol
              
              return (
                <td
                  key={colIndex}
                  role={isFirstCell ? 'rowheader' : 'gridcell'}
                  aria-colindex={colIndex + 1}
                  tabIndex={isFocused ? 0 : -1}
                  data-focused={isFocused ? 'true' : 'false'}
                  {...treegridStyles.cell}
                  p-trigger={{ focus: 'handleCellFocus', click: 'handleCellClick' }}
                >
                  {isFirstCell && hasChildren && (
                    <span {...treegridStyles.expandIcon} aria-hidden='true'>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  )}
                  {String(cellValue)}
                </td>
              )
            })}
          </tr>
        ) as HTMLElement
        
        if (hasChildren) {
          row.setAttribute('aria-expanded', isExpanded ? 'true' : 'false')
        }
        
        allRows.push(row)
        let currentIndex = rowIndex + 1
        
        // Render children if expanded
        if (hasChildren && isExpanded && rowData.children) {
          rowData.children.forEach((child) => {
            currentIndex = renderRow(child, level + 1, currentIndex)
          })
        }
        
        // Clean up parent expansion stack for this level
        parentExpandedStack[level - 1] = undefined
        
        return currentIndex
      }
      
      let currentIndex = 0
      treegridData.forEach(rowData => {
        currentIndex = renderRow(rowData, 1, currentIndex)
      })
      
      tbody.render(...allRows)
      rows = getVisibleRows()
    }
    
    return {
      handleKeydown(event: KeyboardEvent) {
        const visibleRows = getVisibleRows()
        if (visibleRows.length === 0) return
        
        const currentRow = visibleRows[focusedRow]
        const cells = getCellsInRow(currentRow)
        
        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault()
            if (hasChildren(focusedRow) && !isRowExpanded(focusedRow)) {
              expandRow(focusedRow)
            } else if (focusedCol < cells.length - 1) {
              focusedCol++
              updateFocus()
            }
            break
            
          case 'ArrowLeft':
            event.preventDefault()
            if (hasChildren(focusedRow) && isRowExpanded(focusedRow)) {
              collapseRow(focusedRow)
            } else if (focusedCol > 0) {
              focusedCol--
              updateFocus()
            }
            break
            
          case 'ArrowDown':
            event.preventDefault()
            if (focusedRow < visibleRows.length - 1) {
              focusedRow++
              const newCells = getCellsInRow(visibleRows[focusedRow])
              if (focusedCol >= newCells.length) {
                focusedCol = newCells.length - 1
              }
              updateFocus()
            }
            break
            
          case 'ArrowUp':
            event.preventDefault()
            if (focusedRow > 0) {
              focusedRow--
              const newCells = getCellsInRow(visibleRows[focusedRow])
              if (focusedCol >= newCells.length) {
                focusedCol = newCells.length - 1
              }
              updateFocus()
            }
            break
            
          case 'Home':
            event.preventDefault()
            if (event.ctrlKey) {
              focusedRow = 0
            } else {
              focusedCol = 0
            }
            updateFocus()
            break
            
          case 'End':
            event.preventDefault()
            if (event.ctrlKey) {
              focusedRow = visibleRows.length - 1
            } else {
              const cells = getCellsInRow(visibleRows[focusedRow])
              focusedCol = cells.length - 1
            }
            updateFocus()
            break
            
          case 'PageDown':
            event.preventDefault()
            focusedRow = Math.min(focusedRow + 10, visibleRows.length - 1)
            updateFocus()
            break
            
          case 'PageUp':
            event.preventDefault()
            focusedRow = Math.max(focusedRow - 10, 0)
            updateFocus()
            break
            
          case 'Enter':
            event.preventDefault()
            if (hasChildren(focusedRow)) {
              toggleRow(focusedRow)
            }
            break
            
          case ' ': // Space
            if (event.shiftKey) {
              event.preventDefault()
              selectRow(focusedRow, false)
            } else if (event.ctrlKey) {
              event.preventDefault()
              // Select column (if supported)
            } else {
              event.preventDefault()
              selectRow(focusedRow, isMultiSelect)
            }
            break
        }
      },
      
      handleRowClick(event: { target: HTMLElement }) {
        const row = event.target.closest('[role="row"]') as HTMLElement
        if (!row) return
        
        const rowIndex = parseInt(row.getAttribute('data-row-index') || '0', 10)
        const visibleRows = getVisibleRows()
        const index = visibleRows.indexOf(row)
        
        if (index >= 0) {
          focusedRow = index
          focusedCol = 0
          updateFocus()
          
          if (hasChildren(index)) {
            toggleRow(index)
          } else {
            selectRow(index, isMultiSelect)
          }
        }
      },
      
      handleCellFocus(event: { target: HTMLElement }) {
        const cell = event.target
        const row = cell.closest('[role="row"]') as HTMLElement
        if (!row) return
        
        const visibleRows = getVisibleRows()
        const rowIndex = visibleRows.indexOf(row)
        const cells = getCellsInRow(row)
        const colIndex = cells.indexOf(cell)
        
        if (rowIndex >= 0 && colIndex >= 0) {
          focusedRow = rowIndex
          focusedCol = colIndex
        }
      },
      
      handleCellClick(event: { target: HTMLElement }) {
        const cell = event.target
        const row = cell.closest('[role="row"]') as HTMLElement
        if (!row) return
        
        const visibleRows = getVisibleRows()
        const rowIndex = visibleRows.indexOf(row)
        const cells = getCellsInRow(row)
        const colIndex = cells.indexOf(cell)
        
        if (rowIndex >= 0 && colIndex >= 0) {
          focusedRow = rowIndex
          focusedCol = colIndex
          updateFocus()
        }
      },
      
      handleFocus() {
        const visibleRows = getVisibleRows()
        if (visibleRows.length === 0) return
        
        // Focus first cell or first selected row
        if (selectedRows.size > 0) {
          const firstSelected = Math.min(...Array.from(selectedRows))
          if (firstSelected >= 0 && firstSelected < visibleRows.length) {
            focusedRow = firstSelected
          } else {
            focusedRow = 0
          }
        } else {
          focusedRow = 0
        }
        
        focusedCol = 0
        updateFocus()
      },
      
      handleBlur() {
        // Remove focus indicators
        tbody?.querySelectorAll('[role="gridcell"], [role="rowheader"]').forEach(cell => {
          cell.removeAttribute('data-focused')
        })
        tbody?.querySelectorAll('[role="row"]').forEach(row => {
          row.removeAttribute('data-focused')
        })
      },
      
      onConnected() {
        const dataAttr = host.getAttribute('data')
        const ariaLabel = host.getAttribute('aria-label')
        
        if (ariaLabel) {
          treegrid?.setAttribute('aria-label', ariaLabel)
        }
        
        if (isMultiSelect) {
          treegrid?.setAttribute('aria-multiselectable', 'true')
        }
        
        if (dataAttr) {
          try {
            treegridData = JSON.parse(dataAttr)
            renderTreegrid()
          } catch {
            // Invalid JSON
          }
        }
      },
      
      onAttributeChanged({ name, newValue }) {
        if (name === 'data' && newValue) {
          try {
            treegridData = JSON.parse(newValue)
            renderTreegrid()
          } catch {
            // Invalid JSON
          }
        } else if (name === 'aria-label') {
          treegrid?.setAttribute('aria-label', newValue || '')
        } else if (name === 'aria-multiselectable') {
          const isMulti = newValue === 'true'
          if (isMulti) {
            treegrid?.setAttribute('aria-multiselectable', 'true')
          } else {
            treegrid?.removeAttribute('aria-multiselectable')
          }
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - treegrids can be used in bElement shadowDom
- **Uses bElement built-ins**: Yes - `$` for querying, `render()` for dynamic content, `attr()` for attribute management, `p-trigger` for event handling
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

### Navigation

- **Enter**: 
  - If focus is on first cell with `aria-expanded`, opens/closes child rows
  - Otherwise, performs default action for the cell
- **Tab**: Moves focus to next focusable element in row, or out of treegrid if last
- **Right Arrow**:
  - Collapsed row: Expands the row
  - Expanded row or no children: Moves focus to first cell in row
  - Right-most cell: Focus does not move
  - Other cells: Moves focus one cell to the right
- **Left Arrow**:
  - Expanded row: Collapses the row
  - Collapsed row or no children: Focus does not move
  - First cell (if row focus supported): Moves focus to row
  - Other cells: Moves focus one cell to the left
- **Down Arrow**:
  - Row focus: Moves focus one row down
  - Cell focus: Moves focus one cell down
- **Up Arrow**:
  - Row focus: Moves focus one row up
  - Cell focus: Moves focus one cell up
- **Page Down**: Moves focus down multiple rows/cells
- **Page Up**: Moves focus up multiple rows/cells
- **Home**: 
  - Row focus: Moves to first row
  - Cell focus: Moves to first cell in row
- **End**: 
  - Row focus: Moves to last row
  - Cell focus: Moves to last cell in row
- **Control + Home**: Moves to first row or first cell in column
- **Control + End**: Moves to last row or last cell in column

### Selection

- **Control + Space**: 
  - Row focus: Selects all cells in row
  - Cell focus: Selects column
- **Shift + Space**: 
  - Row focus: Selects the row
  - Cell focus: Selects the row
- **Control + A**: Selects all cells
- **Shift + Arrow keys**: Extends selection

## WAI-ARIA Roles, States, and Properties

### Required

- **role="treegrid"**: Container element for the treegrid
- **role="row"**: Each row container
- **role="gridcell"**: Regular cells
- **role="columnheader"**: Column header cells
- **role="rowheader"**: Row header cells (first cell in row)

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for treegrid
- **aria-describedby**: References element providing description
- **aria-multiselectable**: `true` for multi-select treegrids
- **aria-expanded**: `true`/`false` on parent rows (not on end rows)
- **aria-selected**: Selection state on rows or cells
- **aria-level**: Level of row in hierarchy (1-based)
- **aria-posinset**: Position of row within its set of siblings
- **aria-setsize**: Total number of siblings in the set
- **aria-colindex**: Column position
- **aria-rowindex**: Row position
- **aria-readonly**: `true` on cells or treegrid where editing is disabled
- **aria-sort**: Sort state on column headers

## Best Practices

1. **Focusable cells** - All cells must be focusable or contain focusable elements
2. **Navigation modes** - Support rows-first, cells-first, or cells-only modes
3. **Expand/collapse** - Provide clear visual indicators for expandable rows
4. **Focus vs Selection** - Clearly distinguish between focus and selection visually
5. **Level indicators** - Use `aria-level` to communicate hierarchy
6. **Accessible names** - Always provide labels for treegrids
7. **Selection model** - Use consistent selection attributes (`aria-selected`)
8. **Keyboard shortcuts** - Support all standard keyboard interactions
9. **Visual feedback** - Provide clear visual feedback for focus and selection states
10. **Screen reader mode** - Ensure all important content is focusable (screen readers use application mode)

## Accessibility Considerations

- Screen readers use application mode, so only focusable elements are announced
- All cells must be focusable or contain focusable elements
- Focus and selection must be visually distinct
- Keyboard navigation enables efficient grid traversal
- Proper ARIA attributes communicate structure and state
- Expand/collapse state must be clearly communicated
- Hierarchical structure must be clear to screen reader users

## Treegrid Variants

### Single-Select Treegrid
- Only one row can be selected
- Selection may follow focus
- Common for navigation

### Multi-Select Treegrid
- Multiple rows can be selected
- Selection independent of focus
- Common for bulk actions

### E-mail Thread Treegrid
- Hierarchical message threads
- Expand/collapse conversations
- Select messages for actions

### File System Treegrid
- Hierarchical file structure
- File details (size, date, type)
- Expand/collapse folders

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA treegrid pattern has universal support. Ensure proper keyboard navigation implementation for all browsers.

## References

- Source: [W3C ARIA Authoring Practices Guide - Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/)
- MDN: [ARIA treegrid role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/treegrid_role)
- Related: [Tree View Pattern](./aria-treeview-pattern.md) - Similar hierarchical structure
- Related: [Grid Pattern](./aria-grid-pattern.md) - Similar tabular structure
- Related: [Table Pattern](./aria-table-pattern.md) - Static tabular structure
