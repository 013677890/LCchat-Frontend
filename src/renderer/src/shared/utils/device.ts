let cachedDeviceId = ''

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId
  }

  cachedDeviceId = await window.api.device.getId()
  return cachedDeviceId
}
