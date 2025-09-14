import { describe, test, expect } from 'bun:test'
import { createStoryRoute } from '../create-story-route.js'

describe('createStoryRoute', () => {
  test('should create route from basic inputs', () => {
    const result = createStoryRoute({
      filePath: '/src/components/Button.tsx',
      exportName: 'Button',
      storyName: 'Default',
    })

    expect(result).toBe('/src/components/Button/button--default')
  })

  test('should handle camelCase export names', () => {
    const result = createStoryRoute({
      filePath: '/src/components/MyComponent.tsx',
      exportName: 'mySpecialComponent',
      storyName: 'PrimaryVariant',
    })

    expect(result).toBe('/src/components/MyComponent/my-special-component--primary-variant')
  })

  test('should handle PascalCase names', () => {
    const result = createStoryRoute({
      filePath: '/src/ui/NavigationBar.tsx',
      exportName: 'NavigationBar',
      storyName: 'WithDropdown',
    })

    expect(result).toBe('/src/ui/NavigationBar/navigation-bar--with-dropdown')
  })

  test('should handle names with numbers', () => {
    const result = createStoryRoute({
      filePath: '/components/Form2FA.tsx',
      exportName: 'Form2FA',
      storyName: 'Step1',
    })

    expect(result).toBe('/components/Form2FA/form2-f-a--step1')
  })

  test('should handle single word names', () => {
    const result = createStoryRoute({
      filePath: '/src/card.tsx',
      exportName: 'card',
      storyName: 'basic',
    })

    expect(result).toBe('/src/card/card--basic')
  })

  test('should handle names with spaces (converted to kebab-case)', () => {
    const result = createStoryRoute({
      filePath: '/src/components/DataTable.tsx',
      exportName: 'DataTable',
      storyName: 'With Loading State',
    })

    expect(result).toBe('/src/components/DataTable/data-table--with-loading-state')
  })

  test('should handle names with special characters', () => {
    const result = createStoryRoute({
      filePath: '/src/components/Form_Input.tsx',
      exportName: 'FormInput',
      storyName: 'Error-State',
    })

    expect(result).toBe('/src/components/Form_Input/form-input--error-state')
  })

  test('should handle deeply nested file paths', () => {
    const result = createStoryRoute({
      filePath: '/src/components/ui/forms/inputs/TextInput.tsx',
      exportName: 'TextInput',
      storyName: 'Disabled',
    })

    expect(result).toBe('/src/components/ui/forms/inputs/TextInput/text-input--disabled')
  })

  test('should handle relative file paths', () => {
    const result = createStoryRoute({
      filePath: './components/Button.tsx',
      exportName: 'Button',
      storyName: 'Primary',
    })

    expect(result).toBe('./components/Button/button--primary')
  })

  test('should handle file paths without leading slash', () => {
    const result = createStoryRoute({
      filePath: 'src/components/Modal.tsx',
      exportName: 'Modal',
      storyName: 'Large',
    })

    expect(result).toBe('src/components/Modal/modal--large')
  })

  test('should handle Windows-style paths', () => {
    const result = createStoryRoute({
      filePath: 'C:\\src\\components\\Button.tsx',
      exportName: 'Button',
      storyName: 'Default',
    })

    // Windows paths are normalized: backslashes to forward slashes, drive letters removed
    expect(result).toBe('/src/components/Button/button--default')
  })

  test('should handle complex story names with multiple words and punctuation', () => {
    const result = createStoryRoute({
      filePath: '/src/components/AlertDialog.tsx',
      exportName: 'AlertDialog',
      storyName: 'Critical Alert With Actions',
    })

    expect(result).toBe('/src/components/AlertDialog/alert-dialog--critical-alert-with-actions')
  })

  test('should handle export names with underscores', () => {
    const result = createStoryRoute({
      filePath: '/src/components/data_grid.tsx',
      exportName: 'data_grid_component',
      storyName: 'with_pagination',
    })

    expect(result).toBe('/src/components/data_grid/data-grid-component--with-pagination')
  })

  test('should handle edge case with very long names', () => {
    const result = createStoryRoute({
      filePath: '/src/VeryLongComponentNameThatExceedsNormalLength.tsx',
      exportName: 'VeryLongComponentNameThatExceedsNormalLength',
      storyName: 'AnotherVeryLongStoryNameForTesting',
    })

    expect(result).toBe(
      '/src/VeryLongComponentNameThatExceedsNormalLength/very-long-component-name-that-exceeds-normal-length--another-very-long-story-name-for-testing',
    )
  })

  test('should be consistent with same inputs', () => {
    const input = {
      filePath: '/src/components/Button.tsx',
      exportName: 'Button',
      storyName: 'Primary',
    }

    const result1 = createStoryRoute(input)
    const result2 = createStoryRoute(input)

    expect(result1).toBe(result2)
    expect(result1).toBe('/src/components/Button/button--primary')
  })

  test('should handle empty directory paths', () => {
    const result = createStoryRoute({
      filePath: 'Component.tsx',
      exportName: 'Component',
      storyName: 'Story',
    })

    expect(result).toBe('./Component/component--story')
  })

  test('should create unique routes for different stories of same component', () => {
    const baseInput = {
      filePath: '/src/Button.tsx',
      exportName: 'Button',
    }

    const primary = createStoryRoute({ ...baseInput, storyName: 'Primary' })
    const secondary = createStoryRoute({ ...baseInput, storyName: 'Secondary' })
    const disabled = createStoryRoute({ ...baseInput, storyName: 'Disabled' })

    expect(primary).toBe('/src/Button/button--primary')
    expect(secondary).toBe('/src/Button/button--secondary')
    expect(disabled).toBe('/src/Button/button--disabled')

    // Ensure they're all different
    expect(new Set([primary, secondary, disabled])).toHaveProperty('size', 3)
  })

  test('should create unique routes for different exports from same file', () => {
    const baseInput = {
      filePath: '/src/components/Forms.tsx',
      storyName: 'Default',
    }

    const textInput = createStoryRoute({ ...baseInput, exportName: 'TextInput' })
    const selectInput = createStoryRoute({ ...baseInput, exportName: 'SelectInput' })
    const checkboxInput = createStoryRoute({ ...baseInput, exportName: 'CheckboxInput' })

    expect(textInput).toBe('/src/components/Forms/text-input--default')
    expect(selectInput).toBe('/src/components/Forms/select-input--default')
    expect(checkboxInput).toBe('/src/components/Forms/checkbox-input--default')

    // Ensure they're all different
    expect(new Set([textInput, selectInput, checkboxInput])).toHaveProperty('size', 3)
  })
})
