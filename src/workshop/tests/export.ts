const path = Bun.resolveSync('./mocks/template.tsx', import.meta.dir)
const tpl = await import(path)
console.log(tpl)
