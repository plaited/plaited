import { describe, expect, test } from 'bun:test'
import type { SandboxConfig, SandboxFilesystemConfig, SandboxNetworkConfig } from '../acp.types.ts'

// ============================================================================
// Sandbox Type Tests
// ============================================================================

describe('Sandbox Types', () => {
  describe('SandboxNetworkConfig', () => {
    test('supports all network options', () => {
      const config: SandboxNetworkConfig = {
        allowedDomains: ['github.com', '*.example.com'],
        deniedDomains: ['malicious.com'],
        allowUnixSockets: ['/var/run/docker.sock'],
        allowLocalBinding: true,
      }

      expect(config.allowedDomains).toContain('github.com')
      expect(config.deniedDomains).toContain('malicious.com')
      expect(config.allowUnixSockets).toContain('/var/run/docker.sock')
      expect(config.allowLocalBinding).toBe(true)
    })

    test('all fields are optional', () => {
      const config: SandboxNetworkConfig = {}

      expect(config.allowedDomains).toBeUndefined()
      expect(config.deniedDomains).toBeUndefined()
    })
  })

  describe('SandboxFilesystemConfig', () => {
    test('supports all filesystem options', () => {
      const config: SandboxFilesystemConfig = {
        denyRead: ['~/.ssh', '~/.aws'],
        allowWrite: ['.', '/tmp'],
        denyWrite: ['.env', '.git/hooks/'],
      }

      expect(config.denyRead).toContain('~/.ssh')
      expect(config.allowWrite).toContain('.')
      expect(config.denyWrite).toContain('.env')
    })

    test('all fields are optional', () => {
      const config: SandboxFilesystemConfig = {}

      expect(config.denyRead).toBeUndefined()
      expect(config.allowWrite).toBeUndefined()
      expect(config.denyWrite).toBeUndefined()
    })
  })

  describe('SandboxConfig', () => {
    test('requires enabled field', () => {
      const config: SandboxConfig = {
        enabled: true,
      }

      expect(config.enabled).toBe(true)
    })

    test('supports full configuration', () => {
      const config: SandboxConfig = {
        enabled: true,
        network: {
          allowedDomains: ['api.github.com'],
          allowLocalBinding: false,
        },
        filesystem: {
          allowWrite: ['.'],
          denyRead: ['~/.ssh'],
        },
      }

      expect(config.enabled).toBe(true)
      expect(config.network?.allowedDomains).toContain('api.github.com')
      expect(config.filesystem?.allowWrite).toContain('.')
    })
  })
})
