/**
 * Shared dependency for testing code splitting in get-entry-routes.
 * This will be imported by multiple templates to trigger chunk creation.
 */
export const sharedFunction = () => {
  return 'Shared utility function'
}

export const sharedConstant = 'SHARED_VALUE'
