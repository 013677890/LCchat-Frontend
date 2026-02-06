import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useDeviceStore = defineStore('device', () => {
  const deviceId = ref('')

  async function ensureDeviceId(): Promise<string> {
    if (deviceId.value) {
      return deviceId.value
    }

    deviceId.value = await window.api.device.getId()
    return deviceId.value
  }

  return {
    deviceId,
    ensureDeviceId
  }
})
