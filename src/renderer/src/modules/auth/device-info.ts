import type { LoginDeviceInfo } from './api'

function detectPlatform(userAgent: string, platform: string): string {
  const source = `${userAgent} ${platform}`.toLowerCase()
  if (source.includes('windows')) {
    return 'Windows'
  }
  if (source.includes('mac os') || source.includes('macintosh') || source.includes('mac')) {
    return 'macOS'
  }
  if (source.includes('linux')) {
    return 'Linux'
  }
  return platform || 'Unknown'
}

function safeTrim(value: string, fallback: string, maxLength = 128): string {
  const normalized = value.trim()
  if (!normalized) {
    return fallback
  }
  return normalized.slice(0, maxLength)
}

export function buildLoginDeviceInfo(deviceId: string): LoginDeviceInfo {
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent || ''
  const rawPlatform = typeof navigator === 'undefined' ? '' : navigator.platform || ''
  const platform = detectPlatform(userAgent, rawPlatform)

  return {
    deviceName: safeTrim(`LCchat-${deviceId}`, 'LCchat-Unknown', 64),
    platform: safeTrim(platform, 'Unknown', 32),
    osVersion: safeTrim(userAgent, 'Unknown'),
    appVersion: safeTrim(import.meta.env.VITE_APP_VERSION ?? '1.0.0', '1.0.0', 32)
  }
}
