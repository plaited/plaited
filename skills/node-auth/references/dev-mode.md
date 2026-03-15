# Dev Mode Auth

For local development and testing where auth friction should be zero.

## When to Use

- Running `bun plaited dev` locally
- Writing and testing agent logic
- CI/CD test environments
- Any context where the network boundary provides sufficient isolation

## Option A: Accept All (Simplest)

Pass a no-op validator. Any `sid` cookie value is accepted:

```typescript
const server = createServer({
  trigger,
  routes: {
    '/dev/session': new Response('OK', {
      headers: { 'Set-Cookie': `sid=${crypto.randomUUID()}; HttpOnly; SameSite=Strict; Path=/` },
    }),
  },
  validateSession: () => true,
})
```

The client just needs any `sid` cookie set — hit `/dev/session` first.

## Option B: Auto-Session (Slightly Better)

Generate a session token at startup and print it to the terminal. The dev UI auto-injects it:

```typescript
const DEV_TOKEN = crypto.randomUUID()
console.log(`\nDev session: ${DEV_TOKEN}\n`)

const sessions = new Set([DEV_TOKEN])

const routes = {
  '/dev/session': () => {
    const sid = crypto.randomUUID()
    sessions.add(sid)
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Strict; Path=/`,
      },
    })
  },
}

const server = createServer({
  trigger,
  routes,
  validateSession: (sid) => sessions.has(sid),
})
```

## Dependencies

None.

## Key Considerations

- Never use dev-mode auth in production — there's no identity verification
- Option A is fine for solo local development
- Option B is better when multiple people might access the dev server (e.g., sharing a dev environment)
