
const router = new Bun.FileSystemRouter({
  style: "nextjs",
  dir: `${import.meta.dir}/__mocks__`,
  fileExtensions: ['.tsx', '.jsx']
});

console.log(router.routes)
console.log( Bun.fileURLToPath(new URL(import.meta.url)))