/**
 * Reference: Zod schemas for WebAuthn credential storage.
 *
 * These schemas define the shape of the credential JSON file persisted to disk.
 * Copy and adapt to your project — do not import directly from skills/.
 */
import * as z from 'zod'

export const StoredCredentialSchema = z.object({
  id: z.string(),
  publicKey: z.string(),
  counter: z.number(),
  transports: z.array(z.string()).optional(),
  createdAt: z.string(),
})

export type StoredCredential = z.infer<typeof StoredCredentialSchema>

export const OwnerRecordSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  credentials: z.array(StoredCredentialSchema),
  createdAt: z.string(),
})

export type OwnerRecord = z.infer<typeof OwnerRecordSchema>

export const AuthStoreSchema = z.object({
  owner: OwnerRecordSchema.nullable(),
})

export type AuthStore = z.infer<typeof AuthStoreSchema>

export const AuthErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
})

export type AuthErrorResponse = z.infer<typeof AuthErrorResponseSchema>

export const AuthStatusResponseSchema = z.object({
  ok: z.literal(true),
  ownerExists: z.boolean(),
  authenticated: z.boolean(),
})

export type AuthStatusResponse = z.infer<typeof AuthStatusResponseSchema>

export const RegisterOptionsRequestSchema = z.object({
  userName: z.string().min(1),
})

export type RegisterOptionsRequest = z.infer<typeof RegisterOptionsRequestSchema>
