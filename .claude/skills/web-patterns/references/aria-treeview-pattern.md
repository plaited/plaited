# ARIA Tree View Pattern

## Overview

A tree view widget presents a hierarchical list. Any item in the hierarchy may have child items, and items that have children may be expanded or collapsed to show or hide the children. For example, in a file system navigator that uses a tree view to display folders and files, an item representing a folder can be expanded to reveal the contents of the folder, which may be files, folders, or both.

**Key Terms:**
- **Node**: An item in a tree
- **Root Node**: Node at the base of the tree; may have child nodes but no parent
- **Child Node**: Node that has a parent; any node that is not a root node
- **End Node**: Node that does not have any child nodes
- **Parent Node**: Node with one or more child nodes; can be open (expanded) or closed (collapsed)
- **Open Node**: Parent node that is expanded so its child nodes are visible
- **Closed Node**: Parent node that is collapsed so the child nodes are not visible

**Key Characteristics:**
- **Hierarchical structure**: Nodes can contain child nodes
- **Expand/collapse**: Parent nodes can be expanded or collapsed
- **Keyboard navigation**: Arrow keys navigate the tree structure
- **Selection**: Single-select or multi-select modes
- **Focus management**: Can use `aria-activedescendant` for virtual focus
- **Type-ahead**: Recommended for trees with more than 7 root nodes

**Important Notes:**
- Focus and selection are distinct - focus indicates keyboard position, selection indicates chosen items
- In single-select trees, selection may optionally follow focus
- In multi-select trees, selection is always independent of focus
- Visual design must distinguish between focused and selected items

## Use Cases

- File system navigators
- Folder structures
- Navigation menus with nested items
- Category hierarchies
- Document outlines
- Settings panels with nested options
- Organizational charts
- Product catalogs with categories

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Tree View -->
<ul role="tree" aria-label="File Explorer">
  <li role="treeitem" aria-expanded="true" aria-level="1">
    <span>Documents</span>
    <ul role="group">
      <li role="treeitem" aria-level="2">File1.txt</li>
      <li role="treeitem" aria-expanded="false" aria-level="2">
        <span>Projects</span>
        <ul role="group" hidden>
          <li role="treeitem" aria-level="3">Project1</li>
        </ul>
      </li>
    </ul>
  </li>
  <li role="treeitem" aria-level="1">Downloads</li>
</ul>
```

```javascript
// Tree View implementation
const tree = document.querySelector('[role="tree"]')
let focusedNode = null

function toggleNode(node) {
  const isExpanded = node.getAttribute('aria-expanded') === 'true'
  const group = node.querySelector('[role="group"]')
  if (group) {
    node.setAttribute('aria-expanded', !isExpanded)
    group.hidden = isExpanded
  }
}

tree.addEventListener('keydown', (e) => {
  if (!focusedNode) return

  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault()
      const isExpanded = focusedNode.getAttribute('aria-expanded') === 'true'
      const hasChildren = focusedNode.querySelector('[role="group"]') !== null

      if (hasChildren && !isExpanded) {
        toggleNode(focusedNode)
      } else if (hasChildren && isExpanded) {
        const firstChild = focusedNode.querySelector('[role="treeitem"]')
        if (firstChild) setFocus(firstChild)
      }
      break

    case 'ArrowLeft':
      e.preventDefault()
      const isExpanded2 = focusedNode.getAttribute('aria-expanded') === 'true'
      const hasChildren2 = focusedNode.querySelector('[role="group"]') !== null

      if (hasChildren2 && isExpanded2) {
        toggleNode(focusedNode)
      } else {
        const parent = focusedNode.closest('[role="group"]')?.parentElement
        if (parent?.getAttribute('role') === 'treeitem') {
          setFocus(parent)
        }
      }
      break
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, tree views are implemented as **bElements** because they require complex state management (hierarchical structure, expand/collapse, focus, selection, keyboard navigation).

**File Structure:**

```
treeview/
  treeview.css.ts        # Styles (createStyles) - ALWAYS separate
  treeview.stories.tsx   # bElement + stories (imports from css.ts)
```

#### treeview.css.ts

```typescript
// treeview.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
})

export const styles = createStyles({
  tree: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  treeitem: {
    padding: '0.25rem 0',
    cursor: 'pointer',
  },
  treeitemFocused: {
    backgroundColor: '#e0e0e0',
    outline: '2px solid #007bff',
  },
  treeitemSelected: {
    backgroundColor: '#b3d9ff',
  },
  treeitemContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  expandIcon: {
    inlineSize: '1rem',
    textAlign: 'center',
    userSelect: 'none',
  },
  group: {
    listStyle: 'none',
    paddingInlineStart: '1.5rem',
    margin: 0,
  },
})
```

#### treeview.stories.tsx

```typescript
// treeview.stories.tsx
import type { FT } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './treeview.css.ts'

// Types - defined locally
type TreeNode = {
  id: string
  label: string
  children?: TreeNode[]
}

type TreeEvents = {
  select: { node: TreeNode; selected: boolean }
  expand: { node: TreeNode; expanded: boolean }
}

// bElement for tree view - defined locally, NOT exported
const TreeView = bElement<TreeEvents>({
  tag: 'pattern-treeview',
  observedAttributes: ['data', 'aria-label', 'aria-multiselectable'],
  hostStyles,
  shadowDom: (
    <ul
      p-target='tree'
      role='tree'
      tabIndex={0}
      {...styles.tree}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus', click: 'handleClick' }}
    ></ul>
  ),
  bProgram({ $, host, emit }) {
    const tree = $('tree')[0]
    let focusedIndex = -1
    let selectedIndices = new Set<number>()
    let expandedNodes = new Set<string>()
    let treeData: TreeNode[] = []
    const isMultiSelect = host.getAttribute('aria-multiselectable') === 'true'

    const getFlattenedNodes = (): HTMLElement[] => {
      return Array.from(tree?.querySelectorAll('[role="treeitem"]:not([hidden])') || []) as HTMLElement[]
    }

    const hasChildren = (node: HTMLElement): boolean => {
      return node.hasAttribute('aria-expanded')
    }

    const isNodeExpanded = (node: HTMLElement): boolean => {
      return node.getAttribute('aria-expanded') === 'true'
    }

    const toggleNode = (node: HTMLElement, nodeId: string) => {
      const expanded = isNodeExpanded(node)
      if (expanded) {
        expandedNodes.delete(nodeId)
      } else {
        expandedNodes.add(nodeId)
      }
      renderTree()

      const nodeData = findNodeData(nodeId)
      if (nodeData) {
        emit({ type: 'expand', detail: { node: nodeData, expanded: !expanded } })
      }
    }

    const findNodeData = (nodeId: string): TreeNode | null => {
      const find = (items: TreeNode[]): TreeNode | null => {
        for (const item of items) {
          if (item.id === nodeId) return item
          if (item.children) {
            const found = find(item.children)
            if (found) return found
          }
        }
        return null
      }
      return find(treeData)
    }

    const updateFocus = () => {
      const flattened = getFlattenedNodes()
      if (focusedIndex >= 0 && focusedIndex < flattened.length) {
        flattened.forEach((node, idx) => {
          if (idx === focusedIndex) {
            node.setAttribute('class', `${styles.treeitem.classNames.join(' ')} ${styles.treeitemFocused.classNames.join(' ')}`)
            node.setAttribute('tabindex', '0')
          } else {
            node.setAttribute('class', styles.treeitem.classNames.join(' '))
            node.setAttribute('tabindex', '-1')
          }
        })
        flattened[focusedIndex]?.focus()
      }
    }

    const selectNode = (index: number, toggle = false) => {
      const flattened = getFlattenedNodes()
      if (index < 0 || index >= flattened.length) return

      const node = flattened[index]
      const nodeId = node.getAttribute('data-node-id') || ''
      const nodeData = findNodeData(nodeId)

      if (isMultiSelect && toggle) {
        if (selectedIndices.has(index)) {
          selectedIndices.delete(index)
          node.setAttribute('aria-selected', 'false')
        } else {
          selectedIndices.add(index)
          node.setAttribute('aria-selected', 'true')
        }
      } else {
        selectedIndices.forEach((idx) => {
          flattened[idx]?.setAttribute('aria-selected', 'false')
        })
        selectedIndices.clear()
        selectedIndices.add(index)
        node.setAttribute('aria-selected', 'true')
      }

      if (nodeData) {
        emit({
          type: 'select',
          detail: { node: nodeData, selected: selectedIndices.has(index) },
        })
      }
    }

    const renderTree = () => {
      if (!tree) return

      const renderNode = (nodeData: TreeNode, level = 1): HTMLElement => {
        const hasChildNodes = nodeData.children && nodeData.children.length > 0
        const isExpanded = expandedNodes.has(nodeData.id)

        const node = (
          <li
            role='treeitem'
            data-node-id={nodeData.id}
            aria-level={level}
            tabIndex={-1}
            {...styles.treeitem}
          >
            <div {...styles.treeitemContent}>
              {hasChildNodes && (
                <span {...styles.expandIcon} aria-hidden='true'>
                  {isExpanded ? '▼' : '▶'}
                </span>
              )}
              {!hasChildNodes && <span {...styles.expandIcon} aria-hidden='true'></span>}
              <span>{nodeData.label}</span>
            </div>
            {hasChildNodes && (
              <ul role='group' {...styles.group} hidden={!isExpanded}>
                {nodeData.children?.map((child) => renderNode(child, level + 1))}
              </ul>
            )}
          </li>
        ) as HTMLElement

        if (hasChildNodes) {
          node.setAttribute('aria-expanded', isExpanded ? 'true' : 'false')
        }

        return node
      }

      const treeNodes = treeData.map((node) => renderNode(node))
      tree.render(...treeNodes)
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        const flattened = getFlattenedNodes()
        if (flattened.length === 0) return

        const current = flattened[focusedIndex]
        if (!current) return

        const nodeId = current.getAttribute('data-node-id') || ''

        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault()
            if (hasChildren(current)) {
              if (!isNodeExpanded(current)) {
                toggleNode(current, nodeId)
              } else {
                focusedIndex = Math.min(focusedIndex + 1, flattened.length - 1)
                updateFocus()
              }
            }
            break

          case 'ArrowLeft':
            event.preventDefault()
            if (hasChildren(current) && isNodeExpanded(current)) {
              toggleNode(current, nodeId)
            } else if (focusedIndex > 0) {
              // Move to parent
              const parentGroup = current.closest('[role="group"]')
              const parent = parentGroup?.parentElement
              if (parent?.getAttribute('role') === 'treeitem') {
                const parentIndex = flattened.indexOf(parent as HTMLElement)
                if (parentIndex >= 0) {
                  focusedIndex = parentIndex
                  updateFocus()
                }
              }
            }
            break

          case 'ArrowDown':
            event.preventDefault()
            if (focusedIndex < flattened.length - 1) {
              focusedIndex++
              updateFocus()
            }
            break

          case 'ArrowUp':
            event.preventDefault()
            if (focusedIndex > 0) {
              focusedIndex--
              updateFocus()
            }
            break

          case 'Home':
            event.preventDefault()
            focusedIndex = 0
            updateFocus()
            break

          case 'End':
            event.preventDefault()
            focusedIndex = flattened.length - 1
            updateFocus()
            break

          case 'Enter':
            event.preventDefault()
            if (hasChildren(current)) {
              toggleNode(current, nodeId)
            } else {
              selectNode(focusedIndex, false)
            }
            break

          case ' ':
            event.preventDefault()
            selectNode(focusedIndex, isMultiSelect)
            break
        }
      },

      handleFocus() {
        if (focusedIndex < 0) {
          focusedIndex = 0
        }
        updateFocus()
      },

      handleClick(event: { target: HTMLElement }) {
        const node = event.target.closest('[role="treeitem"]') as HTMLElement
        if (!node) return

        const flattened = getFlattenedNodes()
        const index = flattened.indexOf(node)
        if (index >= 0) {
          focusedIndex = index
          updateFocus()

          const nodeId = node.getAttribute('data-node-id') || ''
          if (hasChildren(node)) {
            toggleNode(node, nodeId)
          } else {
            selectNode(index, isMultiSelect)
          }
        }
      },

      onConnected() {
        const dataAttr = host.getAttribute('data')
        const ariaLabel = host.getAttribute('aria-label')

        if (ariaLabel) {
          tree?.setAttribute('aria-label', ariaLabel)
        }

        if (isMultiSelect) {
          tree?.setAttribute('aria-multiselectable', 'true')
        }

        if (dataAttr) {
          try {
            treeData = JSON.parse(dataAttr)
            renderTree()
          } catch {
            // Invalid JSON
          }
        }
      },

      onAttributeChanged({ name, newValue }) {
        if (name === 'data' && newValue) {
          try {
            treeData = JSON.parse(newValue)
            renderTree()
          } catch {
            // Invalid JSON
          }
        } else if (name === 'aria-label') {
          tree?.setAttribute('aria-label', newValue || '')
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const fileExplorer = story({
  intent: 'File system tree view with folders and files',
  template: () => (
    <TreeView
      aria-label='File Explorer'
      data={JSON.stringify([
        {
          id: 'documents',
          label: 'Documents',
          children: [
            { id: 'file1', label: 'File1.txt' },
            {
              id: 'projects',
              label: 'Projects',
              children: [
                { id: 'project1', label: 'Project1' },
                { id: 'project2', label: 'Project2' },
              ],
            },
          ],
        },
        { id: 'downloads', label: 'Downloads' },
      ])}
    />
  ),
  play: async ({ findByAttribute, assert }) => {
    const tree = await findByAttribute('role', 'tree')

    assert({
      given: 'tree is rendered',
      should: 'have accessible label',
      actual: tree?.getAttribute('aria-label'),
      expected: 'File Explorer',
    })
  },
})

export const multiSelectTree = story({
  intent: 'Multi-select tree view for selecting multiple items',
  template: () => (
    <TreeView
      aria-label='Select Items'
      aria-multiselectable='true'
      data={JSON.stringify([
        { id: 'item1', label: 'Item 1' },
        { id: 'item2', label: 'Item 2' },
        { id: 'item3', label: 'Item 3' },
      ])}
    />
  ),
  play: async ({ findByAttribute, assert }) => {
    const tree = await findByAttribute('role', 'tree')

    assert({
      given: 'multi-select tree',
      should: 'have aria-multiselectable',
      actual: tree?.getAttribute('aria-multiselectable'),
      expected: 'true',
    })
  },
})

export const treeviewAccessibility = story({
  intent: 'Verify tree view accessibility structure',
  template: () => (
    <TreeView
      aria-label='Test Tree'
      data={JSON.stringify([
        { id: '1', label: 'Node 1' },
        { id: '2', label: 'Node 2' },
      ])}
    />
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - tree views can be used in bElement shadowDom
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `render`, `attr`
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

### Navigation

- **Right Arrow**: Closed node: Opens the node. Open node: Moves focus to first child
- **Left Arrow**: Open node: Closes the node. Child node: Moves focus to parent
- **Down Arrow**: Moves focus to next visible node
- **Up Arrow**: Moves focus to previous visible node
- **Home**: Moves focus to first node
- **End**: Moves focus to last visible node
- **Enter**: Activates the focused node (performs default action)
- **Space**: Multi-select: Toggles selection. Single-select: Activates the node
- **Type-ahead**: Type characters to move focus to next matching node

## WAI-ARIA Roles, States, and Properties

### Required

- **role="tree"**: Container element for the tree
- **role="treeitem"**: Each node in the tree
- **role="group"**: Container for child nodes of a parent node

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for tree
- **aria-multiselectable**: `true` for multi-select trees
- **aria-expanded**: `true`/`false` on parent nodes (not on end nodes)
- **aria-selected**: Selection state
- **aria-level**: Level of node in hierarchy (1-based)

## Best Practices

1. **Use bElement** - Tree views require complex state coordination
2. **Use spread syntax** - `{...styles.x}` for applying styles
3. **Type-ahead** - Implement for trees with more than 7 root nodes
4. **Focus vs Selection** - Clearly distinguish visually
5. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce tree structure and hierarchy
- Keyboard navigation enables efficient tree traversal
- Focus management ensures logical navigation flow
- Selection state is clearly communicated

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
- MDN: [ARIA tree role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tree_role)
- MDN: [ARIA treeitem role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/treeitem_role)
- Related: [Listbox Pattern](./aria-listbox-pattern.md) - Similar selection patterns
