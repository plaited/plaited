import * as path from 'node:path'
import * as fs from 'node:fs'

export const findLayout = ({dir, ext, root}: {dir: string, ext: '.tsx' | '.jsx', root: string}): string | null => {
  if (!dir.startsWith(root)) {
    console.error(`Error: ${dir} is not a child of ${root}`);
    return null;
  }
  const layoutFilePath = path.join(dir, `layout${ext}`);
  if (fs.existsSync(layoutFilePath)) {
    return layoutFilePath;
  }
  if (dir === root) {
    return null; // We've reached the root directory
  }
  const parentDir = path.dirname(dir);
  return findLayout({dir: parentDir, ext, root});
}