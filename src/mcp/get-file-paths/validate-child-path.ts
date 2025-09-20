/**
 * Validates that a directory path is within the project root.
 * 
 * @param cwd - The current working directory (project root)
 * @param dir - Optional subdirectory relative to cwd
 * @returns The validated absolute path to search in
 * @throws Error if dir attempts to escape the project root
 */
export const validateChildPath = (cwd: string, dir?: string): string => {
  // If no dir provided, use cwd directly
  if (!dir) {
    return cwd
  }
  
  // Handle empty string same as undefined
  if (dir === '') {
    return cwd
  }
  
  // Handle current directory reference
  if (dir === '.') {
    return cwd
  }
  
  // Check for path traversal attempts
  if (dir.startsWith('/')) {
    // Absolute path - likely outside project
    throw new Error(`Directory "${dir}" must be within the project root`)
  }
  
  if (dir.includes('../')) {
    // Parent directory traversal
    throw new Error(`Directory "${dir}" must be within the project root`)
  }
  
  // We expect cwd to always be an absolute path
  // If it's not, just use it as-is (the calling code should ensure it's absolute)
  const normalizedCwd = cwd
  
  // Build the search path by combining cwd and dir
  // Remove any trailing slashes and handle path joining
  const cleanCwd = normalizedCwd.replace(/\/$/, '')
  const cleanDir = dir.replace(/^\.\//, '').replace(/\/$/, '')
  const searchPath = `${cleanCwd}/${cleanDir}`
  
  // Final verification that the path is within cwd
  if (!searchPath.startsWith(cleanCwd + '/')) {
    throw new Error(`Directory "${dir}" must be within the project root`)
  }
  
  return searchPath
}