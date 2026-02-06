import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../modules/auth/views/LoginView.vue'),
    meta: {
      guestOnly: true
    }
  },
  {
    path: '/',
    name: 'chat',
    component: () => import('../modules/chat/views/ChatWorkspaceView.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

export function createAppRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes
  })
}
