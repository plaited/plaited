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
- Type-ahead helps users quickly navigate large trees

## Use Cases

- File system navigators
- Folder structures
- Navigation menus with nested items
- Category hierarchies
- Document outlines
- Settings panels with nested options
- Organizational charts
- Product catalogs with categories

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
let selectedNodes = new Set()

// Flatten tree for navigation
function getFlattenedNodes() {
  const nodes: HTMLElement[] = []
  const walker = (node: HTMLElement) => {
    if (node.getAttribute('role') === 'treeitem' && !node.hidden) {
      nodes.push(node)
    }
    const group = node.querySelector('[role="group"]')
    if (group && !group.hidden) {
      Array.from(group.querySelectorAll('[role="treeitem"]')).forEach(walker)
    }
  }
  Array.from(tree.querySelectorAll('[role="treeitem"]')).forEach(walker)
  return nodes
}

// Get next/previous visible node
function getNextNode(current: HTMLElement): HTMLElement | null {
  const nodes = getFlattenedNodes()
  const index = nodes.indexOf(current)
  return index >= 0 && index < nodes.length - 1 ? nodes[index + 1] : null
}

function getPreviousNode(current: HTMLElement): HTMLElement | null {
  const nodes = getFlattenedNodes()
  const index = nodes.indexOf(current)
  return index > 0 ? nodes[index - 1] : null
}

// Expand/collapse node
function toggleNode(node: HTMLElement) {
  const isExpanded = node.getAttribute('aria-expanded') === 'true'
  const group = node.querySelector('[role="group"]')
  if (group) {
    node.setAttribute('aria-expanded', !isExpanded)
    group.hidden = isExpanded
  }
}

// Keyboard navigation
tree.addEventListener('keydown', (e) => {
  if (!focusedNode) return
  
  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault()
      const isExpanded = focusedNode.getAttribute('aria-expanded') === 'true'
      const hasChildren = focusedNode.querySelector('[role="group"]') !== null
      
      if (hasChildren && !isExpanded) {
        // Open closed node
        toggleNode(focusedNode)
      } else if (hasChildren && isExpanded) {
        // Move to first child
        const group = focusedNode.querySelector('[role="group"]')
        const firstChild = group?.querySelector('[role="treeitem"]') as HTMLElement
        if (firstChild) {
          setFocus(firstChild)
        }
      }
      break
      
    case 'ArrowLeft':
      e.preventDefault()
      const isExpanded2 = focusedNode.getAttribute('aria-expanded') === 'true'
      const hasChildren2 = focusedNode.querySelector('[role="group"]') !== null
      const parent = focusedNode.closest('[role="group"]')?.parentElement
      
      if (hasChildren2 && isExpanded2) {
        // Close open node
        toggleNode(focusedNode)
      } else if (parent && parent.getAttribute('role') === 'treeitem') {
        // Move to parent
        setFocus(parent as HTMLElement)
      }
      break
      
    case 'ArrowDown':
      e.preventDefault()
      const next = getNextNode(focusedNode)
      if (next) setFocus(next)
      break
      
    case 'ArrowUp':
      e.preventDefault()
      const prev = getPreviousNode(focusedNode)
      if (prev) setFocus(prev)
      break
      
    case 'Home':
      e.preventDefault()
      const first = getFlattenedNodes()[0]
      if (first) setFocus(first)
      break
      
    case 'End':
      e.preventDefault()
      const nodes = getFlattenedNodes()
      if (nodes.length > 0) setFocus(nodes[nodes.length - 1])
      break
      
    case 'Enter':
      e.preventDefault()
      activateNode(focusedNode)
      break
  }
})

function setFocus(node: HTMLElement) {
  if (focusedNode) {
    focusedNode.removeAttribute('data-focused')
  }
  focusedNode = node
  node.setAttribute('data-focused', 'true')
  node.focus()
  tree.setAttribute('aria-activedescendant', node.id || '')
}
```

### Plaited Adaptation

**Important**: In Plaited, tree views are implemented as **bElements** because they require complex state management (hierarchical structure, expand/collapse, focus, selection, keyboard navigation).

#### Tree View (bElement)

```typescript
import { bElement, useTemplate } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const treeStyles = createStyles({
  tree: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  treeitem: {
    padding: '0.25rem 0',
    cursor: 'pointer',
    '&[data-focused="true"]': {
      backgroundColor: '#e0e0e0',
      outline: '2px solid #007bff',
    },
    '&[aria-selected="true"]': {
      backgroundColor: '#b3d9ff',
    },
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
    paddingLeft: '1.5rem',
    margin: 0,
  },
})

type TreeNode = {
  id: string
  label: string
  children?: TreeNode[]
}

type TreeEvents = {
  select: { node: TreeNode; selected: boolean }
  activate: { node: TreeNode }
  expand: { node: TreeNode; expanded: boolean }
}

export const TreeView = bElement<TreeEvents>({
  tag: 'accessible-treeview',
  observedAttributes: ['data', 'aria-label', 'aria-multiselectable', 'selection-follows-focus'],
  formAssociated: true,
  shadowDom: (
    <ul
      p-target='tree'
      role='tree'
      tabIndex={0}
      {...treeStyles.tree}
      p-trigger={{ keydown: 'handleKeydown', focus: 'handleFocus', blur: 'handleBlur', click: 'handleNodeClick' }}
    >
      <slot name='nodes'></slot>
    </ul>
  ),
  bProgram({ $, host, internals, emit, root }) {
    const tree = $('tree')[0]
    let nodes: HTMLElement[] = []
    let focusedIndex = -1
    let selectedIndices = new Set<number>()
    let expandedNodes = new Set<string>()
    let treeData: TreeNode[] = []
    const isMultiSelect = host.getAttribute('aria-multiselectable') === 'true'
    const selectionFollowsFocus = host.hasAttribute('selection-follows-focus')
    let typeAheadBuffer = ''
    let typeAheadTimeout: ReturnType<typeof setTimeout> | undefined
    
    const getNodes = (): HTMLElement[] => {
      return Array.from(tree?.querySelectorAll('[role="treeitem"]') || []) as HTMLElement[]
    }
    
    const getFlattenedNodes = (): HTMLElement[] => {
      const flattened: HTMLElement[] = []
      const walker = (node: HTMLElement) => {
        if (node.getAttribute('role') === 'treeitem' && !node.hidden) {
          flattened.push(node)
        }
        const group = node.querySelector('[role="group"]')
        if (group && !group.hidden) {
          Array.from(group.querySelectorAll('[role="treeitem"]')).forEach(child => {
            walker(child as HTMLElement)
          })
        }
      }
      nodes.forEach(walker)
      return flattened
    }
    
    const isNodeExpanded = (node: HTMLElement): boolean => {
      return node.getAttribute('aria-expanded') === 'true'
    }
    
    const hasChildren = (node: HTMLElement): boolean => {
      return node.querySelector('[role="group"]') !== null
    }
    
    const expandNode = (node: HTMLElement) => {
      const group = node.querySelector('[role="group"]')
      if (group) {
        node.attr('aria-expanded', 'true')
        group.removeAttribute('hidden')
        const nodeId = node.getAttribute('data-node-id') || ''
        expandedNodes.add(nodeId)
        
        const nodeData = findNodeData(nodeId)
        if (nodeData) {
          emit({ type: 'expand', detail: { node: nodeData, expanded: true } })
        }
      }
    }
    
    const collapseNode = (node: HTMLElement) => {
      const group = node.querySelector('[role="group"]')
      if (group) {
        node.attr('aria-expanded', 'false')
        group.setAttribute('hidden', '')
        const nodeId = node.getAttribute('data-node-id') || ''
        expandedNodes.delete(nodeId)
        
        const nodeData = findNodeData(nodeId)
        if (nodeData) {
          emit({ type: 'expand', detail: { node: nodeData, expanded: false } })
        }
      }
    }
    
    const toggleNode = (node: HTMLElement) => {
      if (isNodeExpanded(node)) {
        collapseNode(node)
      } else {
        expandNode(node)
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
    
    const updateActiveDescendant = () => {
      const flattened = getFlattenedNodes()
      if (focusedIndex >= 0 && focusedIndex < flattened.length) {
        const focusedNode = flattened[focusedIndex]
        const id = focusedNode.id || `treeitem-${focusedIndex}`
        if (!focusedNode.id) {
          focusedNode.id = id
        }
        tree?.attr('aria-activedescendant', id)
        focusedNode.setAttribute('data-focused', 'true')
        
        // Remove focus from other nodes
        flattened.forEach((node, idx) => {
          if (idx !== focusedIndex) {
            node.removeAttribute('data-focused')
          }
        })
        
        // Scroll into view
        focusedNode.scrollIntoView({ block: 'nearest' })
      } else {
        tree?.attr('aria-activedescendant', null)
      }
    }
    
    const moveFocus = (direction: 'next' | 'prev' | 'first' | 'last' | 'parent' | 'firstChild') => {
      const flattened = getFlattenedNodes()
      if (flattened.length === 0) return
      
      let newIndex = focusedIndex
      
      switch (direction) {
        case 'next':
          newIndex = focusedIndex < flattened.length - 1 ? focusedIndex + 1 : focusedIndex
          break
        case 'prev':
          newIndex = focusedIndex > 0 ? focusedIndex - 1 : focusedIndex
          break
        case 'first':
          newIndex = 0
          break
        case 'last':
          newIndex = flattened.length - 1
          break
        case 'parent': {
          const current = flattened[focusedIndex]
          const parent = current.closest('[role="group"]')?.parentElement
          if (parent && parent.getAttribute('role') === 'treeitem') {
            const parentIndex = flattened.indexOf(parent as HTMLElement)
            if (parentIndex >= 0) {
              newIndex = parentIndex
            }
          }
          break
        }
        case 'firstChild': {
          const current = flattened[focusedIndex]
          if (isNodeExpanded(current)) {
            const group = current.querySelector('[role="group"]')
            const firstChild = group?.querySelector('[role="treeitem"]') as HTMLElement
            if (firstChild) {
              const childIndex = flattened.indexOf(firstChild)
              if (childIndex >= 0) {
                newIndex = childIndex
              }
            }
          }
          break
        }
      }
      
      if (newIndex !== focusedIndex && newIndex >= 0 && newIndex < flattened.length) {
        focusedIndex = newIndex
        updateActiveDescendant()
        
        // Selection follows focus in single-select mode
        if (selectionFollowsFocus && !isMultiSelect) {
          selectNode(focusedIndex, false)
        }
      }
    }
    
    const selectNode = (index: number, toggle = false) => {
      const flattened = getFlattenedNodes()
      if (index < 0 || index >= flattened.length) return
      
      const node = flattened[index]
      const nodeId = node.getAttribute('data-node-id') || ''
      const nodeData = findNodeData(nodeId)
      
      if (isMultiSelect) {
        if (toggle) {
          const isSelected = selectedIndices.has(index)
          if (isSelected) {
            selectedIndices.delete(index)
            node.attr('aria-selected', 'false')
          } else {
            selectedIndices.add(index)
            node.attr('aria-selected', 'true')
          }
        } else {
          selectedIndices.add(index)
          node.attr('aria-selected', 'true')
        }
      } else {
        // Single-select: unselect all others
        selectedIndices.forEach(idx => {
          const otherNode = flattened[idx]
          if (otherNode) {
            otherNode.attr('aria-selected', 'false')
          }
        })
        selectedIndices.clear()
        selectedIndices.add(index)
        node.attr('aria-selected', 'true')
      }
      
      if (nodeData) {
        emit({
          type: 'select',
          detail: { node: nodeData, selected: selectedIndices.has(index) },
        })
      }
      
      updateFormValue()
    }
    
    const activateNode = (index: number) => {
      const flattened = getFlattenedNodes()
      if (index < 0 || index >= flattened.length) return
      
      const node = flattened[index]
      const nodeId = node.getAttribute('data-node-id') || ''
      const nodeData = findNodeData(nodeId)
      
      if (hasChildren(node)) {
        toggleNode(node)
      }
      
      if (nodeData) {
        emit({ type: 'activate', detail: { node: nodeData } })
      }
    }
    
    const updateFormValue = () => {
      const flattened = getFlattenedNodes()
      const selectedNodes = Array.from(selectedIndices)
        .map(idx => flattened[idx])
        .filter(Boolean)
        .map(node => node.getAttribute('data-node-id') || '')
      
      if (isMultiSelect) {
        internals.setFormValue(JSON.stringify(selectedNodes))
      } else {
        internals.setFormValue(selectedNodes[0] || '')
      }
    }
    
    const handleTypeAhead = (char: string) => {
      typeAheadBuffer += char.toLowerCase()
      
      if (typeAheadTimeout) {
        clearTimeout(typeAheadTimeout)
      }
      
      const flattened = getFlattenedNodes()
      const startIndex = (focusedIndex + 1) % flattened.length
      let foundIndex = -1
      
      // Search from current position to end
      for (let i = startIndex; i < flattened.length; i++) {
        const text = (flattened[i].textContent || '').toLowerCase().trim()
        if (text.startsWith(typeAheadBuffer)) {
          foundIndex = i
          break
        }
      }
      
      // If not found, search from beginning
      if (foundIndex === -1) {
        for (let i = 0; i < startIndex; i++) {
          const text = (flattened[i].textContent || '').toLowerCase().trim()
          if (text.startsWith(typeAheadBuffer)) {
            foundIndex = i
            break
          }
        }
      }
      
      if (foundIndex >= 0) {
        focusedIndex = foundIndex
        updateActiveDescendant()
        
        if (selectionFollowsFocus && !isMultiSelect) {
          selectNode(focusedIndex, false)
        }
      }
      
      typeAheadTimeout = setTimeout(() => {
        typeAheadBuffer = ''
      }, 1000)
    }
    
    const renderTree = () => {
      if (!tree) return
      
      const renderNode = (nodeData: TreeNode, level = 1): HTMLElement => {
        const hasChildren = nodeData.children && nodeData.children.length > 0
        const isExpanded = expandedNodes.has(nodeData.id)
        
        const node = (
          <li
            role='treeitem'
            data-node-id={nodeData.id}
            aria-level={level}
            {...treeStyles.treeitem}
          >
            <div {...treeStyles.treeitemContent}>
              {hasChildren && (
                <span {...treeStyles.expandIcon} aria-hidden='true'>
                  {isExpanded ? '▼' : '▶'}
                </span>
              )}
              {!hasChildren && <span {...treeStyles.expandIcon} aria-hidden='true'></span>}
              <span>{nodeData.label}</span>
            </div>
            {hasChildren && (
              <ul
                role='group'
                {...treeStyles.group}
                hidden={!isExpanded}
              >
                {nodeData.children?.map(child => renderNode(child, level + 1))}
              </ul>
            )}
          </li>
        ) as HTMLElement
        
        if (hasChildren) {
          node.setAttribute('aria-expanded', isExpanded ? 'true' : 'false')
        }
        
        return node
      }
      
      const treeNodes = treeData.map(node => renderNode(node))
      tree.render(...treeNodes)
      nodes = getNodes()
    }
    
    return {
      handleKeydown(event: KeyboardEvent) {
        const flattened = getFlattenedNodes()
        if (flattened.length === 0) return
        
        const current = flattened[focusedIndex]
        if (!current) return
        
        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault()
            if (hasChildren(current)) {
              if (!isNodeExpanded(current)) {
                expandNode(current)
              } else {
                moveFocus('firstChild')
              }
            }
            break
            
          case 'ArrowLeft':
            event.preventDefault()
            if (hasChildren(current) && isNodeExpanded(current)) {
              collapseNode(current)
            } else {
              moveFocus('parent')
            }
            break
            
          case 'ArrowDown':
            event.preventDefault()
            moveFocus('next')
            break
            
          case 'ArrowUp':
            event.preventDefault()
            moveFocus('prev')
            break
            
          case 'Home':
            event.preventDefault()
            moveFocus('first')
            break
            
          case 'End':
            event.preventDefault()
            moveFocus('last')
            break
            
          case 'Enter':
            event.preventDefault()
            activateNode(focusedIndex)
            break
            
          case ' ': // Space
            if (isMultiSelect) {
              event.preventDefault()
              selectNode(focusedIndex, true)
            } else {
              activateNode(focusedIndex)
            }
            break
            
          case '*':
            event.preventDefault()
            // Expand all siblings at same level
            const parent = current.closest('[role="group"]')?.parentElement
            if (parent) {
              const siblings = Array.from(parent.querySelectorAll('[role="treeitem"]')) as HTMLElement[]
              siblings.forEach(sibling => {
                if (hasChildren(sibling) && !isNodeExpanded(sibling)) {
                  expandNode(sibling)
                }
              })
            }
            break
            
          default:
            // Type-ahead
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              event.preventDefault()
              handleTypeAhead(event.key)
            }
            break
        }
      },
      
      handleNodeClick(event: { target: HTMLElement }) {
        const node = event.target.closest('[role="treeitem"]') as HTMLElement
        if (!node) return
        
        const flattened = getFlattenedNodes()
        const index = flattened.indexOf(node)
        if (index >= 0) {
          focusedIndex = index
          updateActiveDescendant()
          
          if (hasChildren(node)) {
            toggleNode(node)
          } else {
            selectNode(index, isMultiSelect)
          }
        }
      },
      
      handleFocus() {
        nodes = getNodes()
        const flattened = getFlattenedNodes()
        
        if (flattened.length === 0) return
        
        // Set focus to first node or first selected node
        if (selectedIndices.size > 0) {
          const firstSelected = Math.min(...Array.from(selectedIndices))
          if (firstSelected >= 0 && firstSelected < flattened.length) {
            focusedIndex = firstSelected
          } else {
            focusedIndex = 0
          }
        } else {
          focusedIndex = 0
        }
        
        updateActiveDescendant()
      },
      
      handleBlur() {
        // Remove focus indicators
        const flattened = getFlattenedNodes()
        flattened.forEach(node => {
          node.removeAttribute('data-focused')
        })
        tree?.attr('aria-activedescendant', null)
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
        } else if (name === 'aria-multiselectable') {
          const isMulti = newValue === 'true'
          if (isMulti) {
            tree?.setAttribute('aria-multiselectable', 'true')
          } else {
            tree?.removeAttribute('aria-multiselectable')
          }
        }
      },
      
      onDisconnected() {
        if (typeAheadTimeout) {
          clearTimeout(typeAheadTimeout)
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - tree views can be used in bElement shadowDom
- **Uses bElement built-ins**: Yes - `$` for querying, `render()` for dynamic content, `attr()` for attribute management, `p-trigger` for event handling
- **Requires external web API**: No - uses standard DOM APIs
- **Cleanup required**: Yes - type-ahead timeout must be cleaned up in `onDisconnected`

## Keyboard Interaction

### Focus Management

- **When tree receives focus**:
  - Single-select: Focus on first node, or selected node if one exists
  - Multi-select: Focus on first node, or first selected node if any exist

### Navigation

- **Right Arrow**:
  - Closed node: Opens the node (focus stays)
  - Open node: Moves focus to first child node
  - End node: Does nothing
- **Left Arrow**:
  - Open node: Closes the node (focus stays)
  - Child node: Moves focus to parent node
  - Root end node: Does nothing
- **Down Arrow**: Moves focus to next visible node
- **Up Arrow**: Moves focus to previous visible node
- **Home**: Moves focus to first node
- **End**: Moves focus to last visible node
- **Enter**: Activates the focused node (performs default action)
- **Space**: 
  - Multi-select: Toggles selection of focused node
  - Single-select: Activates the focused node
- **Type-ahead**: Type characters to move focus to next node starting with those characters
- **\*** (Optional): Expands all siblings at the same level as the current node

### Multi-Select (Recommended Model)

- **Space**: Toggles selection of focused node
- **Shift + Down Arrow** (Optional): Moves focus and toggles selection
- **Shift + Up Arrow** (Optional): Moves focus and toggles selection
- **Shift + Space** (Optional): Selects contiguous nodes from last selected to current
- **Control + Shift + Home** (Optional): Selects from first node to current
- **Control + Shift + End** (Optional): Selects from current to last node
- **Control + A** (Optional): Selects all nodes

## WAI-ARIA Roles, States, and Properties

### Required

- **role="tree"**: Container element for the tree
- **role="treeitem"**: Each node in the tree
- **role="group"**: Container for child nodes of a parent node

### Optional

- **aria-label** or **aria-labelledby**: Accessible name for tree
- **aria-multiselectable**: `true` for multi-select trees (default is `false`)
- **aria-expanded**: `true`/`false` on parent nodes (not on end nodes)
- **aria-selected** or **aria-checked**: Selection state (use one consistently)
- **aria-level**: Level of node in hierarchy (1-based)
- **aria-posinset**: Position of node within its set of siblings
- **aria-setsize**: Total number of siblings in the set
- **aria-activedescendant**: ID of currently focused node (for virtual focus)
- **aria-orientation**: `horizontal` for horizontal trees (default is `vertical`)

## Best Practices

1. **Type-ahead** - Implement type-ahead for trees with more than 7 root nodes
2. **Focus vs Selection** - Clearly distinguish between focus and selection visually
3. **Selection follows focus** - Consider this for single-select trees when appropriate
4. **Expand/collapse** - Provide clear visual indicators for expandable nodes
5. **Level indicators** - Use `aria-level` to communicate hierarchy
6. **Accessible names** - Always provide labels for trees
7. **Consistent selection** - Use either `aria-selected` or `aria-checked` consistently
8. **Virtual focus** - Use `aria-activedescendant` for better performance in large trees
9. **Keyboard shortcuts** - Support all standard keyboard interactions
10. **Visual feedback** - Provide clear visual feedback for focus and selection states

## Accessibility Considerations

- Screen readers announce tree structure and hierarchy
- Keyboard navigation enables efficient tree traversal
- Focus management ensures logical navigation flow
- Selection state is clearly communicated
- Type-ahead helps users navigate large trees quickly
- Proper ARIA attributes communicate structure and state
- Visual design distinguishes focus from selection

## Tree View Variants

### Single-Select Tree
- Only one node can be selected
- Selection may follow focus
- Common for navigation

### Multi-Select Tree
- Multiple nodes can be selected
- Selection independent of focus
- Common for file selection

### File System Tree
- Hierarchical file/folder structure
- Expand/collapse folders
- Select files for actions

### Navigation Tree
- Site navigation structure
- Expand/collapse sections
- Navigate to pages

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: ARIA tree view pattern has universal support. Ensure proper keyboard navigation implementation for all browsers.

## References

- Source: [W3C ARIA Authoring Practices Guide - Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
- MDN: [ARIA tree role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tree_role)
- MDN: [ARIA treeitem role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/treeitem_role)
- Related: [Listbox Pattern](./aria-listbox-pattern.md) - Similar selection patterns
- Related: [Menu Pattern](./aria-menubar-pattern.md) - Similar hierarchical navigation
