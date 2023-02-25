We need to fetch the story data. For each set of stories we need to fetch the
set module We then need to iterate over the named exports

```js
const { default: config, ...rest } = await import(path)
const { template } = config
for (const story in rest) {
  const { play, args } = story
  if (play) {
    const context = render(template)
    play({
      context,
      test,
      screenshot,
      ...testingLibrary, // we'll need to make a custom one for this it seems also need to study testing library to understand async methods
    })
  }
}
```
