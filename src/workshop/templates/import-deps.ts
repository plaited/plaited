export const importDeps = (name:string, stories:string) => `import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { ${name} } from '${stories}'`