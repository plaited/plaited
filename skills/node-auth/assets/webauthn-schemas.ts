/**
 * Reference: Zod schemas for WebAuthn credential storage.
 *
 * These schemas define the shape of the credential JSON file persisted to disk.
 * Copy and adapt to your project — do not import directly from skills/.
 */
import * as z from 'zod'

/**
 * Stored WebAuthn credential entry.
 *
 * @remarks
 * Persisted per credential in the owner's `credentials` array.
 * `publicKey` is base64url-encoded using `isoBase64URL.fromBuffer()`.
 */
export const StoredCredentialSchema = z.object({
  id: z.string(),
  publicKey: z.string(),
  counter: z.number(),
  transports: z.array(z.string()).optional(),
  createdAt: z.string(),
})

/** @see {@link StoredCredentialSchema} */
export type StoredCredential = z.infer<typeof StoredCredentialSchema>

/**
 * Single-tenant owner record containing all registered passkeys.
 *
 * @remarks
 * `userId` is a base64url-encoded 32-byte random value.
 * Only one owner exists per node in the sovereign model.
 */
export const OwnerRecordSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  credentials: z.array(StoredCredentialSchema),
  createdAt: z.string(),
})

/** @see {@link OwnerRecordSchema} */
export type OwnerRecord = z.infer<typeof OwnerRecordSchema>

/**
 * Top-level credentials file structure written to disk.
 *
 * @remarks
 * `owner` is `null` until the first registration completes.
 */
export const AuthStoreSchema = z.object({
  owner: OwnerRecordSchema.nullable(),
})

/** @see {@link AuthStoreSchema} */
export type AuthStore = z.infer<typeof AuthStoreSchema>

/** Error response shape for all auth route failures. */
export const AuthErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
})

/** @see {@link AuthErrorResponseSchema} */
export type AuthErrorResponse = z.infer<typeof AuthErrorResponseSchema>

/** Success response shape for the `/auth/status` route. */
export const AuthStatusResponseSchema = z.object({
  ok: z.literal(true),
  ownerExists: z.boolean(),
  authenticated: z.boolean(),
})

/** @see {@link AuthStatusResponseSchema} */
export type AuthStatusResponse = z.infer<typeof AuthStatusResponseSchema>

/** Request body for the `/auth/register/options` route. */
export const RegisterOptionsRequestSchema = z.object({
  userName: z.string().min(1),
})

/** @see {@link RegisterOptionsRequestSchema} */
export type RegisterOptionsRequest = z.infer<typeof RegisterOptionsRequestSchema>
