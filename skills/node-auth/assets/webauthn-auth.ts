/**
 * Reference: WebAuthn passkey auth for sovereign/local nodes.
 *
 * Single-tenant model — one owner per node with multiple passkeys.
 * Credentials persisted to a JSON file, sessions in-memory.
 *
 * Copy and adapt to your project. Requires: bun add @simplewebauthn/server
 */

import { dirname } from 'node:path'
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
} from '@simplewebauthn/server'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { keyMirror } from '../../src/utils.ts'
import type { OwnerRecord, StoredCredential } from './webauthn-schemas.ts'
import { AuthStoreSchema, RegisterOptionsRequestSchema } from './webauthn-schemas.ts'

// ── Constants ────────────────────────────────────────────────────────────────

export const AUTH_ERRORS = keyMirror(
  'owner_exists',
  'not_authenticated',
  'challenge_expired',
  'verification_failed',
  'credential_not_found',
  'invalid_input',
  'no_owner',
)

export const AUTH_ROUTES = {
  status: '/auth/status',
  registerOptions: '/auth/register/options',
  registerVerify: '/auth/register/verify',
  loginOptions: '/auth/login/options',
  loginVerify: '/auth/login/verify',
} as const

const CHALLENGE_TTL_MS = 5 * 60 * 1000
const SESSION_MAX_AGE_S = 24 * 60 * 60

// ── Types ────────────────────────────────────────────────────────────────────

type PendingChallenge = {
  challenge: string
  userName?: string
  createdAt: number
}

type SessionEntry = {
  userId: string
  createdAt: number
}

export type CreateAuthRoutesOptions = {
  rpName: string
  rpID: string
  expectedOrigin: string
  credentialPath?: string
  secure?: boolean
  _verifyRegistration?: (opts: {
    response: RegistrationResponseJSON
    expectedChallenge: string
    expectedOrigin: string
    expectedRPID: string
  }) => Promise<VerifiedRegistrationResponse>
  _verifyAuthentication?: (opts: {
    response: AuthenticationResponseJSON
    expectedChallenge: string
    expectedOrigin: string
    expectedRPID: string
    credential: { id: string; publicKey: Uint8Array; counter: number; transports?: string[] }
  }) => Promise<VerifiedAuthenticationResponse>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const jsonResponse = (body: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

const errorResponse = (error: string, status = 400) => jsonResponse({ ok: false, error }, status)

const parseSid = (req: Request): string | undefined => {
  const cookies = new Bun.CookieMap(req.headers.get('cookie') ?? '')
  return cookies.get('sid') ?? undefined
}

const sidCookie = (sid: string, secure: boolean) =>
  `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE_S}${secure ? '; Secure' : ''}`

const loadStore = async (path: string): Promise<{ owner: OwnerRecord | null }> => {
  const file = Bun.file(path)
  if (!(await file.exists())) return { owner: null }
  const raw = await file.text()
  return AuthStoreSchema.parse(JSON.parse(raw))
}

const saveStore = async (path: string, owner: OwnerRecord | null): Promise<void> => {
  const dir = dirname(path)
  const dirFile = Bun.file(dir)
  if (!(await dirFile.exists())) {
    await Bun.$`mkdir -p ${dir}`.quiet()
  }
  await Bun.write(path, JSON.stringify({ owner }, null, 2))
}

// ── Factory ─────────────────────────────────────────────────────────────────

/**
 * Creates WebAuthn authentication routes for single-tenant passkey auth.
 *
 * @remarks
 * Returns five route handlers, an `isValidSession` callback for WebSocket
 * upgrade validation, and a `destroy` function for cleanup.
 *
 * Note: The route type here uses a generic ServeRoutes. When adapting this
 * to your project, import your project's WebSocketData type and parameterize
 * accordingly: `Bun.Serve.Routes<YourWebSocketData, string>`.
 */
export const createAuthRoutes = async (options: CreateAuthRoutesOptions) => {
  const {
    rpName,
    rpID,
    expectedOrigin,
    credentialPath = '.auth/credentials.json',
    secure = false,
    _verifyRegistration,
    _verifyAuthentication,
  } = options

  const challengeStore = new Map<string, PendingChallenge>()
  const sessionStore = new Map<string, SessionEntry>()
  let owner: OwnerRecord | null = (await loadStore(credentialPath)).owner

  const purgeInterval = setInterval(() => {
    const now = Date.now()
    for (const [sid, entry] of challengeStore) {
      if (now - entry.createdAt > CHALLENGE_TTL_MS) challengeStore.delete(sid)
    }
  }, CHALLENGE_TTL_MS)

  const routes: Record<string, Record<string, (req: Request) => Response | Promise<Response>>> = {
    [AUTH_ROUTES.status]: {
      GET: (req: Request) => {
        const sid = parseSid(req)
        const authenticated = sid ? sessionStore.has(sid) : false
        return jsonResponse({ ok: true, ownerExists: owner !== null, authenticated })
      },
    },

    [AUTH_ROUTES.registerOptions]: {
      POST: async (req: Request) => {
        if (owner) {
          const sid = parseSid(req)
          if (!sid || !sessionStore.has(sid)) {
            return errorResponse(AUTH_ERRORS.owner_exists, 403)
          }
        }

        let body: unknown
        try {
          body = await req.json()
        } catch {
          return errorResponse(AUTH_ERRORS.invalid_input)
        }
        const parsed = RegisterOptionsRequestSchema.safeParse(body)
        if (!parsed.success) return errorResponse(AUTH_ERRORS.invalid_input)

        const { userName } = parsed.data
        const userID = owner ? isoBase64URL.toBuffer(owner.userId) : crypto.getRandomValues(new Uint8Array(32))

        const excludeCredentials = owner
          ? owner.credentials.map((c) => ({
              id: c.id,
              transports: c.transports as AuthenticatorTransportFuture[] | undefined,
            }))
          : []

        const opts = await generateRegistrationOptions({
          rpName,
          rpID,
          userName,
          userID,
          excludeCredentials,
          authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
        })

        const sid = crypto.randomUUID()
        challengeStore.set(sid, { challenge: opts.challenge, userName, createdAt: Date.now() })
        return jsonResponse(opts, 200, { 'Set-Cookie': sidCookie(sid, secure) })
      },
    },

    [AUTH_ROUTES.registerVerify]: {
      POST: async (req: Request) => {
        const sid = parseSid(req)
        if (!sid) return errorResponse(AUTH_ERRORS.challenge_expired)

        const pending = challengeStore.get(sid)
        if (!pending) return errorResponse(AUTH_ERRORS.challenge_expired)

        if (Date.now() - pending.createdAt > CHALLENGE_TTL_MS) {
          challengeStore.delete(sid)
          return errorResponse(AUTH_ERRORS.challenge_expired)
        }

        let body: unknown
        try {
          body = await req.json()
        } catch {
          return errorResponse(AUTH_ERRORS.invalid_input)
        }

        const verifyFn = _verifyRegistration ?? verifyRegistrationResponse
        let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>
        try {
          verification = await verifyFn({
            response: body as Parameters<typeof verifyRegistrationResponse>[0]['response'],
            expectedChallenge: pending.challenge,
            expectedOrigin,
            expectedRPID: rpID,
          })
        } catch {
          return errorResponse(AUTH_ERRORS.verification_failed)
        }

        if (!verification.verified || !verification.registrationInfo) {
          return errorResponse(AUTH_ERRORS.verification_failed)
        }

        challengeStore.delete(sid)

        const { credential } = verification.registrationInfo
        const storedCred: StoredCredential = {
          id: credential.id,
          publicKey: isoBase64URL.fromBuffer(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports,
          createdAt: new Date().toISOString(),
        }

        if (owner) {
          owner.credentials.push(storedCred)
        } else {
          owner = {
            userId: isoBase64URL.fromBuffer(crypto.getRandomValues(new Uint8Array(32))),
            userName: pending.userName ?? 'owner',
            credentials: [storedCred],
            createdAt: new Date().toISOString(),
          }
        }

        await saveStore(credentialPath, owner)
        sessionStore.set(sid, { userId: owner.userId, createdAt: Date.now() })
        return jsonResponse({ ok: true, verified: true }, 200, { 'Set-Cookie': sidCookie(sid, secure) })
      },
    },

    [AUTH_ROUTES.loginOptions]: {
      POST: async () => {
        if (!owner) return errorResponse(AUTH_ERRORS.no_owner)

        const allowCredentials = owner.credentials.map((c) => ({
          id: c.id,
          transports: c.transports as AuthenticatorTransportFuture[] | undefined,
        }))

        const opts = await generateAuthenticationOptions({
          rpID,
          allowCredentials,
          userVerification: 'preferred',
        })

        const sid = crypto.randomUUID()
        challengeStore.set(sid, { challenge: opts.challenge, createdAt: Date.now() })
        return jsonResponse(opts, 200, { 'Set-Cookie': sidCookie(sid, secure) })
      },
    },

    [AUTH_ROUTES.loginVerify]: {
      POST: async (req: Request) => {
        if (!owner) return errorResponse(AUTH_ERRORS.no_owner)

        const sid = parseSid(req)
        if (!sid) return errorResponse(AUTH_ERRORS.challenge_expired)

        const pending = challengeStore.get(sid)
        if (!pending) return errorResponse(AUTH_ERRORS.challenge_expired)

        if (Date.now() - pending.createdAt > CHALLENGE_TTL_MS) {
          challengeStore.delete(sid)
          return errorResponse(AUTH_ERRORS.challenge_expired)
        }

        let body: unknown
        try {
          body = await req.json()
        } catch {
          return errorResponse(AUTH_ERRORS.invalid_input)
        }

        const response = body as Parameters<typeof verifyAuthenticationResponse>[0]['response']
        const stored = owner.credentials.find((c) => c.id === response.id)
        if (!stored) return errorResponse(AUTH_ERRORS.credential_not_found)

        const credential = {
          id: stored.id,
          publicKey: isoBase64URL.toBuffer(stored.publicKey),
          counter: stored.counter,
          transports: stored.transports as AuthenticatorTransportFuture[] | undefined,
        }

        const verifyFn = _verifyAuthentication ?? verifyAuthenticationResponse
        let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>
        try {
          verification = await verifyFn({
            response,
            expectedChallenge: pending.challenge,
            expectedOrigin,
            expectedRPID: rpID,
            credential,
          })
        } catch {
          return errorResponse(AUTH_ERRORS.verification_failed)
        }

        if (!verification.verified) {
          return errorResponse(AUTH_ERRORS.verification_failed)
        }

        challengeStore.delete(sid)
        stored.counter = verification.authenticationInfo.newCounter
        await saveStore(credentialPath, owner)
        sessionStore.set(sid, { userId: owner.userId, createdAt: Date.now() })
        return jsonResponse({ ok: true, verified: true }, 200, { 'Set-Cookie': sidCookie(sid, secure) })
      },
    },
  }

  const isValidSession = (sessionId: string): boolean => sessionStore.has(sessionId)

  const destroy = () => {
    clearInterval(purgeInterval)
    challengeStore.clear()
    sessionStore.clear()
  }

  return { routes, isValidSession, destroy }
}
