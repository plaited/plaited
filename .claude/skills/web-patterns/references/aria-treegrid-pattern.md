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

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

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

function getVisibleRows() {
  return Array.from(treegrid.querySelectorAll('[role="row"]:not([hidden])'))
}

function getCellsInRow(row) {
  return Array.from(row.querySelectorAll('[role="gridcell"], [role="rowheader"]'))
}

function toggleRow(row) {
  const isExpanded = row.getAttribute('aria-expanded') === 'true'
  const childRows = getChildRows(row)
  childRows.forEach(child => {
    child.hidden = isExpanded
  })
  row.setAttribute('aria-expanded', !isExpanded)
}

treegrid.addEventListener('keydown', (e) => {
  const rows = getVisibleRows()
  const currentRow = rows[focusedRow]
  const cells = getCellsInRow(currentRow)

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
        updateFocus()
      }
      break

    case 'ArrowUp':
      e.preventDefault()
      if (focusedRow > 0) {
        focusedRow--
        updateFocus()
      }
      break
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, treegrids are implemented as **bElements** because they require complex state management (hierarchical structure, expand/collapse, focus on rows/cells, selection, keyboard navigation).

**File Structure:**

```
treegrid/
  treegrid.css.ts        # Styles (createStyles) - ALWAYS separate
  treegrid.stories.tsx   # bElement + stories (imports from css.ts)
```

#### treegrid.css.ts

```typescript
// treegrid.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
  inlineSize: '100%',
})

export const styles = createStyles({
  treegrid: {
    display: 'table',
    inlineSize: '100%',
    borderCollapse: 'collapse',
    border: '1px solid #ccc',
  },
  row: {
    display: 'table-row',
  },
  rowFocused: {
    backgroundColor: '#e0e0e0',
    outline: '2px solid #007bff',
  },
  rowSelected: {
    backgroundColor: '#b3d9ff',
  },
  cell: {
    display: 'table-cell',
    padding: '0.5rem',
    border: '1px solid #e0e0e0',
  },
  cellFocused: {
    outline: '2px solid #007bff',
  },
  expandIcon: {
    display: 'inline-block',
    inlineSize: '1rem',
    textAlign: 'center',
    marginInlineEnd: '0.5rem',
    userSelect: 'none',
  },
  header: {
    display: 'table-cell',
    padding: '0.5rem',
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    border: '1px solid #e0e0e0',
  },
})
```

#### treegrid.stories.tsx

```typescript
// treegrid.stories.tsx
import type { FT } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './treegrid.css.ts'

// Types - defined locally
type TreegridRow = {
  id: string
  cells: (string | number)[]
  children?: TreegridRow[]
}

type TreegridEvents = {
  cellFocus: { row: number; col: number; value: unknown }
  rowExpand: { row: number; expanded: boolean }
}

// bElement for treegrid - defined locally, NOT exported
const Treegrid = bElement<TreegridEvents>({
  tag: 'pattern-treegrid',
  observedAttributes: ['data', 'aria-label'],
  hostStyles,
  shadowDom: (
    <table
      p-target='treegrid'
      role='treegrid'
      tabIndex={0}
      {...styles.treegrid}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus' }}
    >
      <thead p-target='thead'>
        <slot name='headers'></slot>
      </thead>
      <tbody p-target='tbody'></tbody>
    </table>
  ),
  bProgram({ $, host, emit }) {
    const treegrid = $('treegrid')[0]
    const tbody = $('tbody')[0]
    let focusedRow = 0
    let focusedCol = 0
    let expandedRows = new Set<string>()
    let treegridData: TreegridRow[] = []

    const getVisibleRows = (): HTMLElement[] => {
      return Array.from(tbody?.querySelectorAll('[role="row"]:not([hidden])') || []) as HTMLElement[]
    }

    const getCellsInRow = (row: HTMLElement): HTMLElement[] => {
      return Array.from(row.querySelectorAll('[role="gridcell"], [role="rowheader"]')) as HTMLElement[]
    }

    const hasChildren = (row: HTMLElement): boolean => {
      return row.hasAttribute('aria-expanded')
    }

    const isRowExpanded = (row: HTMLElement): boolean => {
      return row.getAttribute('aria-expanded') === 'true'
    }

    const toggleRow = (row: HTMLElement, rowId: string) => {
      const expanded = isRowExpanded(row)
      if (expanded) {
        expandedRows.delete(rowId)
      } else {
        expandedRows.add(rowId)
      }
      renderTreegrid()
      emit({ type: 'rowExpand', detail: { row: focusedRow, expanded: !expanded } })
    }

    const updateFocus = () => {
      const visibleRows = getVisibleRows()
      if (visibleRows.length === 0) return

      if (focusedRow >= visibleRows.length) {
        focusedRow = visibleRows.length - 1
      }

      const cells = getCellsInRow(visibleRows[focusedRow])
      if (cells.length === 0) return

      if (focusedCol >= cells.length) {
        focusedCol = cells.length - 1
      }

      tbody?.querySelectorAll('[role="gridcell"], [role="rowheader"]').forEach((cell) => {
        cell.setAttribute('tabindex', '-1')
        cell.setAttribute('class', styles.cell.classNames.join(' '))
      })

      const targetCell = cells[focusedCol]
      if (targetCell) {
        targetCell.setAttribute('tabindex', '0')
        targetCell.setAttribute('class', `${styles.cell.classNames.join(' ')} ${styles.cellFocused.classNames.join(' ')}`)
        targetCell.focus()
      }
    }

    const renderTreegrid = () => {
      if (!tbody) return

      const renderRow = (rowData: TreegridRow, level = 1): HTMLElement => {
        const hasChildRows = rowData.children && rowData.children.length > 0
        const isExpanded = expandedRows.has(rowData.id)

        const cells = rowData.cells.map((cellValue, colIndex) => {
          const isFirstCell = colIndex === 0

          return (
            <td
              key={colIndex}
              role={isFirstCell ? 'rowheader' : 'gridcell'}
              tabIndex={-1}
              {...styles.cell}
            >
              {isFirstCell && hasChildRows && (
                <span {...styles.expandIcon} aria-hidden='true'>
                  {isExpanded ? '▼' : '▶'}
                </span>
              )}
              {!hasChildRows && isFirstCell && (
                <span {...styles.expandIcon} aria-hidden='true'></span>
              )}
              {String(cellValue)}
            </td>
          )
        })

        const row = (
          <tr
            role='row'
            aria-level={level}
            data-row-id={rowData.id}
            {...styles.row}
          >
            {cells}
          </tr>
        ) as HTMLElement

        if (hasChildRows) {
          row.setAttribute('aria-expanded', isExpanded ? 'true' : 'false')
        }

        return row
      }

      const allRows: HTMLElement[] = []
      const walkTree = (rows: TreegridRow[], level = 1, parentExpanded = true) => {
        rows.forEach((rowData) => {
          const row = renderRow(rowData, level)
          if (!parentExpanded) {
            row.setAttribute('hidden', '')
          }
          allRows.push(row)

          if (rowData.children && rowData.children.length > 0) {
            const isExpanded = expandedRows.has(rowData.id)
            walkTree(rowData.children, level + 1, parentExpanded && isExpanded)
          }
        })
      }

      walkTree(treegridData)
      tbody.render(...allRows)
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        const visibleRows = getVisibleRows()
        if (visibleRows.length === 0) return

        const currentRow = visibleRows[focusedRow]
        const cells = getCellsInRow(currentRow)
        const rowId = currentRow.getAttribute('data-row-id') || ''

        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault()
            if (hasChildren(currentRow) && !isRowExpanded(currentRow)) {
              toggleRow(currentRow, rowId)
            } else if (focusedCol < cells.length - 1) {
              focusedCol++
              updateFocus()
            }
            break

          case 'ArrowLeft':
            event.preventDefault()
            if (hasChildren(currentRow) && isRowExpanded(currentRow)) {
              toggleRow(currentRow, rowId)
            } else if (focusedCol > 0) {
              focusedCol--
              updateFocus()
            }
            break

          case 'ArrowDown':
            event.preventDefault()
            if (focusedRow < visibleRows.length - 1) {
              focusedRow++
              updateFocus()
            }
            break

          case 'ArrowUp':
            event.preventDefault()
            if (focusedRow > 0) {
              focusedRow--
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
              focusedCol = cells.length - 1
            }
            updateFocus()
            break

          case 'Enter':
            event.preventDefault()
            if (hasChildren(currentRow)) {
              toggleRow(currentRow, rowId)
            }
            break
        }
      },

      handleFocus() {
        focusedRow = 0
        focusedCol = 0
        updateFocus()
      },

      onConnected() {
        const dataAttr = host.getAttribute('data')
        const ariaLabel = host.getAttribute('aria-label')

        if (ariaLabel) {
          treegrid?.setAttribute('aria-label', ariaLabel)
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
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const emailInbox = story({
  intent: 'E-mail inbox treegrid with threaded conversations',
  template: () => (
    <Treegrid
      aria-label='E-mail Inbox'
      data={JSON.stringify([
        {
          id: '1',
          cells: ['Project Update', 'john@example.com', '2024-01-15'],
          children: [
            { id: '1-1', cells: ['Re: Project Update', 'jane@example.com', '2024-01-16'] },
            { id: '1-2', cells: ['Re: Project Update', 'bob@example.com', '2024-01-17'] },
          ],
        },
        {
          id: '2',
          cells: ['Meeting Notes', 'alice@example.com', '2024-01-14'],
        },
      ])}
    >
      <tr slot='headers' role='row'>
        <th role='columnheader'>Subject</th>
        <th role='columnheader'>From</th>
        <th role='columnheader'>Date</th>
      </tr>
    </Treegrid>
  ),
  play: async ({ findByAttribute, assert }) => {
    const treegrid = await findByAttribute('role', 'treegrid')

    assert({
      given: 'treegrid is rendered',
      should: 'have accessible label',
      actual: treegrid?.getAttribute('aria-label'),
      expected: 'E-mail Inbox',
    })
  },
})

export const treegridAccessibility = story({
  intent: 'Verify treegrid accessibility structure',
  template: () => (
    <Treegrid
      aria-label='Test Treegrid'
      data={JSON.stringify([
        { id: '1', cells: ['Item 1', 'Value 1'] },
        { id: '2', cells: ['Item 2', 'Value 2'] },
      ])}
    >
      <tr slot='headers' role='row'>
        <th role='columnheader'>Name</th>
        <th role='columnheader'>Value</th>
      </tr>
    </Treegrid>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - treegrids can be used in bElement shadowDom
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `render`, `attr`
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

### Navigation

- **Enter**: If focus is on first cell with `aria-expanded`, opens/closes child rows
- **Right Arrow**: Collapsed row: Expands the row. Expanded row: Moves focus to first cell
- **Left Arrow**: Expanded row: Collapses the row. First cell: Focus does not move
- **Down Arrow**: Moves focus one row/cell down
- **Up Arrow**: Moves focus one row/cell up
- **Home**: Moves to first row or first cell in row
- **End**: Moves to last row or last cell in row
- **Control + Home**: Moves to first row or first cell in column
- **Control + End**: Moves to last row or last cell in column

## WAI-ARIA Roles, States, and Properties

### Required

- **role="treegrid"**: Container element for the treegrid
- **role="row"**: Each row container
- **role="gridcell"**: Regular cells
- **role="columnheader"**: Column header cells
- **role="rowheader"**: Row header cells (first cell in row)

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for treegrid
- **aria-expanded**: `true`/`false` on parent rows (not on end rows)
- **aria-level**: Level of row in hierarchy (1-based)
- **aria-selected**: Selection state on rows or cells

## Best Practices

1. **Use bElement** - Treegrids require complex state coordination
2. **Use spread syntax** - `{...styles.x}` for applying styles
3. **Focusable cells** - All cells must be focusable or contain focusable elements
4. **Focus vs Selection** - Clearly distinguish between focus and selection visually
5. **Level indicators** - Use `aria-level` to communicate hierarchy
6. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers use application mode, so only focusable elements are announced
- All cells must be focusable or contain focusable elements
- Focus and selection must be visually distinct
- Keyboard navigation enables efficient grid traversal

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/)
- MDN: [ARIA treegrid role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/treegrid_role)
- Related: [Tree View Pattern](./aria-treeview-pattern.md) - Similar hierarchical structure
- Related: [Grid Pattern](./aria-grid-pattern.md) - Similar tabular structure
