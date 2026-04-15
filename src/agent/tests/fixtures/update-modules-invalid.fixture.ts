const invalidModule = (_params: unknown) => ({
  handlers: {
    bad_handler: 'not-a-function' as never,
  },
})

export default [invalidModule]
