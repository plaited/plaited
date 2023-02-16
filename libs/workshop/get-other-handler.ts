export const getOtherHandler = (
  template = '<h1>404 Not Found</h1>',
) =>
(_req: Request): Response => {
  return new Response(template, {
    headers: { 'Content-Type': 'text/html' },
    status: 404,
  })
}
