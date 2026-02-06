/// <reference types="vite/client" />

import type { ElectronAPI } from '@electron-toolkit/preload'
import type { BridgeApi } from '../../shared/types/bridge'

declare global {
  interface Window {
    electron: ElectronAPI
    api: BridgeApi
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

export {}
