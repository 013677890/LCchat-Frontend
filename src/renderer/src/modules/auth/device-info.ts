import type { LoginDeviceInfo } from './api'

// 后端 proto validate 对 platform 的白名单：["iOS","Android","Web","Windows","Mac"]，
// 返回值必须收敛到该集合，否则登录请求会被参数校验打回。
function detectPlatform(userAgent: string, platform: string): string {
  const source = `${userAgent} ${platform}`.toLowerCase()
  if (source.includes('windows')) {
    return 'Windows'
  }
  if (source.includes('mac os') || source.includes('macintosh') || source.includes('mac')) {
    return 'Mac'
  }
  if (source.includes('iphone') || source.includes('ipad') || source.includes('ios')) {
    return 'iOS'
  }
  if (source.includes('android')) {
    return 'Android'
  }
  // Linux 等其他环境后端枚举未覆盖，统一以 Web 上报
  return 'Web'
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
    platform,
    // 后端限制 os_version 最长 32 字符，完整 UA 会被打回
    osVersion: safeTrim(userAgent, 'Unknown', 32),
    appVersion: safeTrim(import.meta.env.VITE_APP_VERSION ?? '1.0.0', '1.0.0', 32)
  }
}
