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
    component: () => import('./layouts/MainLayout.vue'),
    meta: {
      requiresAuth: true
    },
    children: [
      {
        path: '',
        name: 'chat',
        component: () => import('../modules/chat/views/ChatView.vue'),
      },
      {
        path: 'contact',
        name: 'contact',
        component: () => import('../modules/contact/views/ContactView.vue'),
      },
      {
        path: 'discover',
        name: 'discover',
        component: () => import('../modules/discover/views/DiscoverView.vue'),
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('../modules/settings/views/SettingsView.vue'),
      }
    ]
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
