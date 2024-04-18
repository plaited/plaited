import * as path from 'node:path';

export const  stripCommonStart = (files: Map<string, string>): Map<string, string> => {
  // Split each file path into parts
  const splitFiles = [...files].map(([name, url]): [string, string[]] => [name, path.resolve(url.replace(/\.(t|j)s(x)?$/, '.js')).split(path.sep)]);

  // Find the shortest file path
  const shortest = Math.min(...splitFiles.map(([_, parts]) => parts.length));

  // Find the common parts
  const commonParts = [];
  for (let i = 0; i < shortest; i++) {
    const [_, part] = splitFiles[0][i];
    if (splitFiles.every(([_, parts]) => parts[i] === part)) {
      commonParts.push(part);
    } else {
      break;
    }
  }

  // Strip the common parts from each file path
  const strippedFiles = splitFiles.map(([name, parts]):[string, string] => [name, parts.slice(commonParts.length).join(path.sep)]);

  return new Map(strippedFiles);
}

const router = new Bun.FileSystemRouter({
  style: "nextjs",
  dir: "./pages",
  origin: "https://mydomain.com",
  assetPrefix: "_next/static/"
});