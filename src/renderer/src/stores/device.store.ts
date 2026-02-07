import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { fetchDevices, kickDevice, type DeviceRecord } from '../modules/security/api'

export const useDeviceStore = defineStore('device', () => {
  const deviceId = ref('')
  const devices = shallowRef<DeviceRecord[]>([])
  const loading = ref(false)

  async function ensureDeviceId(): Promise<string> {
    if (deviceId.value) {
      return deviceId.value
    }

    deviceId.value = await window.api.device.getId()
    return deviceId.value
  }

  function reset(): void {
    devices.value = []
    loading.value = false
  }

  async function loadDevices(): Promise<void> {
    loading.value = true
    try {
      const response = await fetchDevices()
      devices.value = response.data.devices ?? []
    } finally {
      loading.value = false
    }
  }

  async function kickById(targetDeviceId: string): Promise<void> {
    if (!targetDeviceId) {
      return
    }

    await kickDevice(targetDeviceId)
    await loadDevices()
  }

  return {
    deviceId,
    devices,
    loading,
    ensureDeviceId,
    reset,
    loadDevices,
    kickById
  }
})
