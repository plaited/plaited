import { beforeEach, expect, test } from 'bun:test'
import type { ReleaseChange } from '../changelog.ts'
import { clearChanges, formatChangelog, generateChangelog, getVersionsWithChanges, recordChange } from '../changelog.ts'

// Clean database between tests
beforeEach(async () => {
  const { db, initDB } = await import('../../databases/db.ts')
  await initDB()

  // Clear all tables
  db.exec('DELETE FROM release_changes')
})

test('recordChange: inserts change record and returns ID', () => {
  const change: ReleaseChange = {
    changeType: 'added',
    tableName: 'examples',
    recordId: 1,
    exportName: 'bElement',
    description: 'Added basic custom element example',
  }

  const id = recordChange('7.3.0', change)
  expect(id).toBeGreaterThan(0)
})

test('recordChange: stores all change fields correctly', () => {
  const change: ReleaseChange = {
    changeType: 'modified',
    tableName: 'patterns',
    recordId: 5,
    exportName: 'story',
    description: 'Updated story pattern with new assertions',
  }

  recordChange('7.3.0', change)

  const changes = generateChangelog('7.3.0')
  expect(changes.length).toBe(1)

  const stored = changes[0]
  expect(stored?.changeType).toBe('modified')
  expect(stored?.tableName).toBe('patterns')
  expect(stored?.recordId).toBe(5)
  expect(stored?.exportName).toBe('story')
  expect(stored?.description).toBe('Updated story pattern with new assertions')
})

test('generateChangelog: returns all changes for a version', () => {
  recordChange('7.3.0', {
    changeType: 'added',
    tableName: 'examples',
    description: 'Added example 1',
  })

  recordChange('7.3.0', {
    changeType: 'modified',
    tableName: 'patterns',
    description: 'Modified pattern 1',
  })

  recordChange('7.4.0', {
    changeType: 'removed',
    tableName: 'examples',
    description: 'Removed outdated example',
  })

  const v730Changes = generateChangelog('7.3.0')
  expect(v730Changes.length).toBe(2)

  const v740Changes = generateChangelog('7.4.0')
  expect(v740Changes.length).toBe(1)
})

test('generateChangelog: returns empty array for version with no changes', () => {
  const changes = generateChangelog('8.0.0')
  expect(changes).toEqual([])
})

test('formatChangelog: generates markdown with grouped changes', () => {
  recordChange('7.3.0', {
    changeType: 'added',
    tableName: 'examples',
    exportName: 'bElement',
    description: 'Basic custom element example',
  })

  recordChange('7.3.0', {
    changeType: 'added',
    tableName: 'patterns',
    exportName: 'signal-pattern',
    description: 'Signal state management pattern',
  })

  recordChange('7.3.0', {
    changeType: 'modified',
    tableName: 'examples',
    exportName: 'story',
    description: 'Updated story example with assertions',
  })

  recordChange('7.3.0', {
    changeType: 'removed',
    tableName: 'patterns',
    description: 'Removed deprecated pattern',
  })

  const changes = generateChangelog('7.3.0')
  const markdown = formatChangelog('7.3.0', changes)

  expect(markdown).toContain('## Database Changes for v7.3.0')
  expect(markdown).toContain('### Added')
  expect(markdown).toContain('### Modified')
  expect(markdown).toContain('### Removed')
  expect(markdown).toContain('| Table | Export | Description |')
  expect(markdown).toContain('| examples | bElement | Basic custom element example |')
  expect(markdown).toContain('| patterns | signal-pattern | Signal state management pattern |')
})

test('formatChangelog: handles empty changes gracefully', () => {
  const markdown = formatChangelog('7.3.0', [])

  expect(markdown).toContain('## Database Changes for v7.3.0')
  expect(markdown).toContain('No database changes in this release')
})

test('formatChangelog: handles missing export names with dash', () => {
  recordChange('7.3.0', {
    changeType: 'removed',
    tableName: 'patterns',
    description: 'Removed deprecated pattern',
  })

  const changes = generateChangelog('7.3.0')
  const markdown = formatChangelog('7.3.0', changes)

  expect(markdown).toContain('| patterns | - | Removed deprecated pattern |')
})

test('formatChangelog: groups changes by type', () => {
  // Add changes in random order
  recordChange('7.3.0', {
    changeType: 'modified',
    tableName: 'examples',
    description: 'Modified 1',
  })

  recordChange('7.3.0', {
    changeType: 'added',
    tableName: 'patterns',
    description: 'Added 1',
  })

  recordChange('7.3.0', {
    changeType: 'removed',
    tableName: 'examples',
    description: 'Removed 1',
  })

  recordChange('7.3.0', {
    changeType: 'added',
    tableName: 'examples',
    description: 'Added 2',
  })

  const changes = generateChangelog('7.3.0')
  const markdown = formatChangelog('7.3.0', changes)

  // Check that sections appear in order: Added, Modified, Removed
  const addedIndex = markdown.indexOf('### Added')
  const modifiedIndex = markdown.indexOf('### Modified')
  const removedIndex = markdown.indexOf('### Removed')

  expect(addedIndex).toBeGreaterThan(-1)
  expect(modifiedIndex).toBeGreaterThan(addedIndex)
  expect(removedIndex).toBeGreaterThan(modifiedIndex)
})

test('getVersionsWithChanges: returns all versions with changes', () => {
  recordChange('7.2.0', {
    changeType: 'added',
    tableName: 'examples',
    description: 'Initial examples',
  })

  recordChange('7.3.0', {
    changeType: 'modified',
    tableName: 'patterns',
    description: 'Updated patterns',
  })

  recordChange('7.3.0', {
    changeType: 'added',
    tableName: 'examples',
    description: 'More examples',
  })

  recordChange('7.4.0', {
    changeType: 'removed',
    tableName: 'patterns',
    description: 'Removed pattern',
  })

  const versions = getVersionsWithChanges()
  expect(versions).toContain('7.2.0')
  expect(versions).toContain('7.3.0')
  expect(versions).toContain('7.4.0')
  expect(new Set(versions).size).toBe(3) // No duplicates
})

test('getVersionsWithChanges: returns empty array when no changes', () => {
  const versions = getVersionsWithChanges()
  expect(versions).toEqual([])
})

test('clearChanges: removes all changes for a version', () => {
  recordChange('7.3.0', {
    changeType: 'added',
    tableName: 'examples',
    description: 'Change 1',
  })

  recordChange('7.3.0', {
    changeType: 'modified',
    tableName: 'patterns',
    description: 'Change 2',
  })

  recordChange('7.4.0', {
    changeType: 'added',
    tableName: 'examples',
    description: 'Change 3',
  })

  const deletedCount = clearChanges('7.3.0')
  expect(deletedCount).toBe(2)

  // Verify 7.3.0 changes are gone
  const v730Changes = generateChangelog('7.3.0')
  expect(v730Changes).toEqual([])

  // Verify 7.4.0 changes still exist
  const v740Changes = generateChangelog('7.4.0')
  expect(v740Changes.length).toBe(1)
})

test('clearChanges: returns 0 when version has no changes', () => {
  const deletedCount = clearChanges('8.0.0')
  expect(deletedCount).toBe(0)
})

test('recordChange: supports changes without recordId or exportName', () => {
  const change: ReleaseChange = {
    changeType: 'removed',
    tableName: 'patterns',
    description: 'Removed deprecated pattern without ID',
  }

  const id = recordChange('7.3.0', change)
  expect(id).toBeGreaterThan(0)

  const changes = generateChangelog('7.3.0')
  expect(changes.length).toBe(1)
  // SQLite returns null for NULL values
  expect(changes[0]?.recordId).toBeNull()
  expect(changes[0]?.exportName).toBeNull()
})

test('formatChangelog: generates valid markdown table structure', () => {
  recordChange('7.3.0', {
    changeType: 'added',
    tableName: 'examples',
    exportName: 'test',
    description: 'Test example',
  })

  const changes = generateChangelog('7.3.0')
  const markdown = formatChangelog('7.3.0', changes)

  // Check table structure
  expect(markdown).toContain('| Table | Export | Description |')
  expect(markdown).toContain('|-------|--------|-------------|')
  expect(markdown).toContain('| examples | test | Test example |')
})

test('integration: complete release workflow', () => {
  const version = '7.3.0'

  // Record various changes
  recordChange(version, {
    changeType: 'added',
    tableName: 'examples',
    exportName: 'bElement',
    recordId: 1,
    description: 'Added shadow DOM example',
  })

  recordChange(version, {
    changeType: 'added',
    tableName: 'patterns',
    exportName: 'behavioral-pattern',
    recordId: 1,
    description: 'Added b-thread coordination pattern',
  })

  recordChange(version, {
    changeType: 'modified',
    tableName: 'examples',
    exportName: 'story',
    recordId: 5,
    description: 'Updated story example with better assertions',
  })

  // Generate changelog
  const changes = generateChangelog(version)
  expect(changes.length).toBe(3)

  // Format as markdown
  const markdown = formatChangelog(version, changes)
  expect(markdown).toContain('## Database Changes for v7.3.0')
  expect(markdown).toContain('### Added')
  expect(markdown).toContain('### Modified')

  // Verify version is tracked
  const versions = getVersionsWithChanges()
  expect(versions).toContain(version)

  // Clear changes (rollback scenario)
  const cleared = clearChanges(version)
  expect(cleared).toBe(3)

  // Verify cleared
  const afterClear = generateChangelog(version)
  expect(afterClear).toEqual([])
})
