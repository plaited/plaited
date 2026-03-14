/**
 * Reference: Integration tests for WebAuthn passkey auth.
 *
 * Tests the full HTTP flow (cookies, challenges, sessions, file persistence)
 * using mock verification overrides — no real authenticator needed.
 *
 * Copy and adapt to your project. Adjust import paths as needed.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { VerifiedAuthenticationResponse, VerifiedRegistrationResponse } from '@simplewebauthn/server'
import { AUTH_ERRORS, AUTH_ROUTES, createAuthRoutes } from './webauthn-auth.ts'

// ── Test Helpers ─────────────────────────────────────────────────────────────

const TEST_RP_NAME = 'Test RP'
const TEST_RP_ID = 'localhost'
const TEST_ORIGIN = 'http://localhost'
const FAKE_CRED_ID = 'dGVzdC1jcmVkLWlk'
const FAKE_PUBLIC_KEY = 'dGVzdC1wdWJsaWMta2V5'

const httpUrl = (port: number, path: string) => `http://localhost:${port}${path}`

const extractSid = (res: Response): string | undefined => {
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) return undefined
  const match = setCookie.match(/sid=([^;]+)/)
  return match?.[1]
}

const mockVerifyRegistration =
  (
    credId = FAKE_CRED_ID,
    publicKey = FAKE_PUBLIC_KEY,
  ): NonNullable<Parameters<typeof createAuthRoutes>[0]['_verifyRegistration']> =>
  async () =>
    ({
      verified: true,
      registrationInfo: {
        fmt: 'none',
        aaguid: '00000000-0000-0000-0000-000000000000',
        credential: {
          id: credId,
          publicKey: new TextEncoder().encode(publicKey),
          counter: 0,
          transports: ['internal'],
        },
        credentialType: 'public-key',
        attestationObject: new Uint8Array(),
        userVerified: true,
        credentialDeviceType: 'multiDevice',
        credentialBackedUp: false,
        origin: TEST_ORIGIN,
        rpID: TEST_RP_ID,
      },
    }) as VerifiedRegistrationResponse

const mockVerifyAuthentication =
  (): NonNullable<Parameters<typeof createAuthRoutes>[0]['_verifyAuthentication']> => async () =>
    ({
      verified: true,
      authenticationInfo: {
        credentialID: FAKE_CRED_ID,
        newCounter: 1,
        userVerified: true,
        credentialDeviceType: 'multiDevice',
        credentialBackedUp: false,
        origin: TEST_ORIGIN,
        rpID: TEST_RP_ID,
      },
    }) as VerifiedAuthenticationResponse

const tempCredPath = () => join(import.meta.dir, `.tmp-auth-${crypto.randomUUID()}.json`)

const cleanup = async (path: string) => {
  const file = Bun.file(path)
  if (await file.exists()) await Bun.$`rm ${path}`.quiet()
}

/**
 * Helper: create a test server with auth routes.
 * Adapt this to use your project's createServer instead of Bun.serve directly.
 */
const createTestServer = (auth: Awaited<ReturnType<typeof createAuthRoutes>>) => {
  const server = Bun.serve({
    port: 0,
    routes: auth.routes,
    fetch: () => new Response('Not Found', { status: 404 }),
  })
  return server
}

const registerOwner = async (port: number) => {
  const optionsRes = await fetch(httpUrl(port, AUTH_ROUTES.registerOptions), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'test-owner' }),
  })
  expect(optionsRes.status).toBe(200)
  const sid = extractSid(optionsRes)
  expect(sid).toBeDefined()

  const verifyRes = await fetch(httpUrl(port, AUTH_ROUTES.registerVerify), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `sid=${sid}` },
    body: JSON.stringify({ id: FAKE_CRED_ID, rawId: FAKE_CRED_ID, type: 'public-key', response: {} }),
  })
  expect(verifyRes.status).toBe(200)
  return extractSid(verifyRes) ?? sid!
}

// ── Auth Status ──────────────────────────────────────────────────────────────

describe('Auth Status', () => {
  const credPath = tempCredPath()
  let destroy: () => void
  let server: ReturnType<typeof createTestServer>

  afterAll(async () => {
    destroy()
    server.stop(true)
    await cleanup(credPath)
  })

  test('setup', async () => {
    const auth = await createAuthRoutes({
      rpName: TEST_RP_NAME,
      rpID: TEST_RP_ID,
      expectedOrigin: TEST_ORIGIN,
      credentialPath: credPath,
      _verifyRegistration: mockVerifyRegistration(),
    })
    destroy = auth.destroy
    server = createTestServer(auth)
  })

  test('returns ownerExists: false when no owner', async () => {
    const res = await fetch(httpUrl(server.port!, AUTH_ROUTES.status))
    const body = await res.json()
    expect(body).toEqual({ ok: true, ownerExists: false, authenticated: false })
  })

  test('returns ownerExists: true and authenticated: true after registration', async () => {
    const sid = await registerOwner(server.port!)
    const res = await fetch(httpUrl(server.port!, AUTH_ROUTES.status))
    const body = await res.json()
    expect(body.ownerExists).toBe(true)

    const authRes = await fetch(httpUrl(server.port!, AUTH_ROUTES.status), {
      headers: { Cookie: `sid=${sid}` },
    })
    expect((await authRes.json()).authenticated).toBe(true)
  })
})

// ── Registration Flow ────────────────────────────────────────────────────────

describe('Registration Flow', () => {
  const credPath = tempCredPath()
  let destroy: () => void
  let server: ReturnType<typeof createTestServer>

  afterAll(async () => {
    destroy()
    server.stop(true)
    await cleanup(credPath)
  })

  test('setup', async () => {
    const auth = await createAuthRoutes({
      rpName: TEST_RP_NAME,
      rpID: TEST_RP_ID,
      expectedOrigin: TEST_ORIGIN,
      credentialPath: credPath,
      _verifyRegistration: mockVerifyRegistration(),
    })
    destroy = auth.destroy
    server = createTestServer(auth)
  })

  test('register/options returns challenge and sets sid cookie', async () => {
    const res = await fetch(httpUrl(server.port!, AUTH_ROUTES.registerOptions), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'test-owner' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.challenge).toBeDefined()
    expect(body.rp.name).toBe(TEST_RP_NAME)
    expect(extractSid(res)).toBeDefined()
  })

  test('register/options rejects invalid body', async () => {
    const res = await fetch(httpUrl(server.port!, AUTH_ROUTES.registerOptions), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(AUTH_ERRORS.invalid_input)
  })

  test('register/verify creates owner and persists to file', async () => {
    await registerOwner(server.port!)
    const file = Bun.file(credPath)
    expect(await file.exists()).toBe(true)
    const store = JSON.parse(await file.text())
    expect(store.owner.credentials[0].id).toBe(FAKE_CRED_ID)
  })

  test('second registration requires auth when owner exists', async () => {
    const res = await fetch(httpUrl(server.port!, AUTH_ROUTES.registerOptions), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'second' }),
    })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe(AUTH_ERRORS.owner_exists)
  })
})

// ── Authentication Flow ──────────────────────────────────────────────────────

describe('Authentication Flow', () => {
  const credPath = tempCredPath()
  let destroy: () => void
  let server: ReturnType<typeof createTestServer>

  afterAll(async () => {
    destroy()
    server.stop(true)
    await cleanup(credPath)
  })

  test('setup — register owner first', async () => {
    const auth = await createAuthRoutes({
      rpName: TEST_RP_NAME,
      rpID: TEST_RP_ID,
      expectedOrigin: TEST_ORIGIN,
      credentialPath: credPath,
      _verifyRegistration: mockVerifyRegistration(),
      _verifyAuthentication: mockVerifyAuthentication(),
    })
    destroy = auth.destroy
    server = createTestServer(auth)
    await registerOwner(server.port!)
  })

  test('login/options returns challenge with allowCredentials', async () => {
    const res = await fetch(httpUrl(server.port!, AUTH_ROUTES.loginOptions), { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.allowCredentials[0].id).toBe(FAKE_CRED_ID)
  })

  test('login/verify authenticates and creates session', async () => {
    const optionsRes = await fetch(httpUrl(server.port!, AUTH_ROUTES.loginOptions), { method: 'POST' })
    const sid = extractSid(optionsRes)

    const verifyRes = await fetch(httpUrl(server.port!, AUTH_ROUTES.loginVerify), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sid=${sid}` },
      body: JSON.stringify({
        id: FAKE_CRED_ID,
        rawId: FAKE_CRED_ID,
        type: 'public-key',
        response: { clientDataJSON: 'dGVzdA', authenticatorData: 'dGVzdA', signature: 'dGVzdA' },
        clientExtensionResults: {},
      }),
    })
    expect(verifyRes.status).toBe(200)
    expect((await verifyRes.json()).verified).toBe(true)
  })

  test('login/verify rejects unknown credential', async () => {
    const optionsRes = await fetch(httpUrl(server.port!, AUTH_ROUTES.loginOptions), { method: 'POST' })
    const sid = extractSid(optionsRes)

    const res = await fetch(httpUrl(server.port!, AUTH_ROUTES.loginVerify), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sid=${sid}` },
      body: JSON.stringify({
        id: 'unknown',
        rawId: 'unknown',
        type: 'public-key',
        response: { clientDataJSON: 'dGVzdA', authenticatorData: 'dGVzdA', signature: 'dGVzdA' },
        clientExtensionResults: {},
      }),
    })
    expect((await res.json()).error).toBe(AUTH_ERRORS.credential_not_found)
  })
})

// ── Session Management ───────────────────────────────────────────────────────

describe('Session Management', () => {
  const credPath = tempCredPath()
  let destroy: () => void
  let isValidSession: (id: string) => boolean
  let server: ReturnType<typeof createTestServer>

  afterAll(async () => {
    server.stop(true)
    await cleanup(credPath)
  })

  test('setup', async () => {
    const auth = await createAuthRoutes({
      rpName: TEST_RP_NAME,
      rpID: TEST_RP_ID,
      expectedOrigin: TEST_ORIGIN,
      credentialPath: credPath,
      _verifyRegistration: mockVerifyRegistration(),
    })
    destroy = auth.destroy
    isValidSession = auth.isValidSession
    server = createTestServer(auth)
  })

  test('isValidSession returns false for unknown, true after registration, false after destroy', async () => {
    expect(isValidSession('nonexistent')).toBe(false)
    const sid = await registerOwner(server.port!)
    expect(isValidSession(sid)).toBe(true)
    destroy()
    expect(isValidSession(sid)).toBe(false)
  })
})

// ── File Persistence ─────────────────────────────────────────────────────────

describe('File Persistence', () => {
  const credPath = tempCredPath()

  afterAll(async () => {
    await cleanup(credPath)
  })

  test('owner record survives across instances', async () => {
    const auth1 = await createAuthRoutes({
      rpName: TEST_RP_NAME,
      rpID: TEST_RP_ID,
      expectedOrigin: TEST_ORIGIN,
      credentialPath: credPath,
      _verifyRegistration: mockVerifyRegistration(),
      _verifyAuthentication: mockVerifyAuthentication(),
    })
    const server1 = createTestServer(auth1)
    await registerOwner(server1.port!)
    auth1.destroy()
    server1.stop(true)

    const auth2 = await createAuthRoutes({
      rpName: TEST_RP_NAME,
      rpID: TEST_RP_ID,
      expectedOrigin: TEST_ORIGIN,
      credentialPath: credPath,
      _verifyAuthentication: mockVerifyAuthentication(),
    })
    const server2 = createTestServer(auth2)
    const statusRes = await fetch(httpUrl(server2.port!, AUTH_ROUTES.status))
    expect((await statusRes.json()).ownerExists).toBe(true)
    auth2.destroy()
    server2.stop(true)
  })
})
