import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '../App.vue'
import { installRouterGuards } from './guards'
import { createAppRouter } from './router'

export function bootstrap(): void {
  const app = createApp(App)
  const pinia = createPinia()
  const router = createAppRouter()

  installRouterGuards(router, pinia)
  app.use(pinia)
  app.use(router)
  app.mount('#app')
}
