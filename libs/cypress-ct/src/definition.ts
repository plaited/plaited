//@ts-ignore: no types
import { defineComponentFramework } from 'cypress'
//@ts-ignore: no types
const plaitedDep: Cypress.CypressComponentDependency = {
  // Unique, semantic identifier.
  type: 'plaited',

  // Human readable name.
  name: 'Plaited',

  // Package name install from `npm`.
  package: 'plated',

  /**
   * Similar to package, but can include a version or tag.
   * Used during setup to generate an install command for users.
   */
  installer: 'plaited@^5',

  // Human readable description.
  description: 'Rapidly code web interfaces as requirements change and evolve.',

  // Minimum supported version.
  minVersion: '^5.0.1',
}

/**
 * The actual definition.
 */
export default defineComponentFramework({
  /**
   * This should match the `npm` package name.
   * The convention required to ensure your Definition is processed
   * by Cypress is `cypress-ct-*` for global packages, or
   * `@org/cypress-ct-*` for organization level packages.
   */
  type: '@plaited/cypress-ct',

  /**
   * The label that shows up when configuring Component Testing
   * for the first time.
   */
  name: 'Plaited',

  /**
   * Supported bundlers. Can be "webpack" and/or "vite".
   */
  supportedBundlers: ['vite'],

  /**
   * Used by Cypress to automatically detect the correct Framework Definition
   * based on the user's project.
   */
  detectors: [plaitedDep],

  /**
   * Supply a set of dependencies a project should have to use this Framework Definition. The user will be prompted to install them if they are not found.
   * Optionally, supply different dependencies based on the chosen bundler.
   */
  dependencies: () => {
    return [plaitedDep]
  },

  /**
   * An SVG icon. Shown when configuring Component Testing for the first time.
   * Optional, but good for branding your Framework Definition.
   */
  icon: `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200">
    <path fill="#00e8ff" d="M40 120l20-60l90 90l-30 50l-40-40h-20"/>
    <path fill="#283198" d="M80 160v-80l40-40v80M0 160l40 40l20-40l-20-40h-20"/>
    <path fill="#324fff" d="M40 120v-80l40-40v80M120 200v-80l40-40v80M0 160v-80l40 40"/>
    <path fill="#0ff" d="M40 200v-80l40 40"/>
  </svg>
  `,
})
