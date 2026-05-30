<script setup lang="ts">
import { computed, ref } from 'vue'
import { MessageCircle, Users, Compass, Settings, LogOut } from 'lucide-vue-next'
import type { MainNavKey } from '../../../stores/app.store'

const props = defineProps<{
  activeNav: MainNavKey
  userLabel: string
  avatarUrl?: string
  discoverBadge?: number
  connStatus?: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'auth_failed'
}>()

const emit = defineEmits<{
  select: [MainNavKey]
  logout: []
  clickAvatar: []
}>()

const navItems = [
  { key: 'chat', label: '消息', icon: MessageCircle },
  { key: 'contacts', label: '通讯录', icon: Users },
  { key: 'discover', label: '发现', icon: Compass },
  { key: 'settings', label: '设置', icon: Settings }
] as const

function handleSelect(nav: MainNavKey): void {
  emit('select', nav)
}

const userInitial = computed(() => {
  const normalized = props.userLabel.trim()
  if (!normalized) {
    return 'U'
  }
  return normalized.slice(0, 1).toUpperCase()
})

const activeNavIndex = computed(() => {
  return navItems.findIndex(item => item.key === props.activeNav)
})

const particleCanvasRef = ref<HTMLCanvasElement | null>(null)

function explodeParticles() {
  const canvas = particleCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = 120
  canvas.height = 120

  const centerX = 60
  const centerY = 60

  interface Particle {
    x: number
    y: number
    vx: number
    vy: number
    size: number
    color: string
    alpha: number
    decay: number
  }

  const particles: Particle[] = []
  const colors = ['#00C670', '#00E583', '#34D399', '#10B981', '#6EE7B7'] as const

  for (let i = 0; i < 28; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = Math.random() * 3 + 2
    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 3 + 2,
      color: colors[Math.floor(Math.random() * colors.length)] as string,
      alpha: 1,
      decay: Math.random() * 0.03 + 0.015
    })
  }

  function animate() {
    if (particles.length === 0) return
    const currentCtx = ctx
    const currentCanvas = canvas
    if (!currentCtx || !currentCanvas) return

    currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height)

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      if (!p) continue

      p.x += p.vx
      p.y += p.vy
      p.alpha -= p.decay

      if (p.alpha <= 0) {
        particles.splice(i, 1)
        continue
      }

      currentCtx.save()
      currentCtx.globalAlpha = p.alpha
      currentCtx.fillStyle = p.color
      currentCtx.beginPath()
      currentCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      currentCtx.fill()
      currentCtx.restore()
    }

    requestAnimationFrame(animate)
  }

  animate()
}

function handleAvatarClick() {
  explodeParticles()
  emit('clickAvatar')
}
</script>

<template>
  <aside class="sidebar">
    <header class="brand" title="LCchat">
      LC
      <span v-if="props.connStatus" class="status-dot" :class="'status-dot--' + props.connStatus" :title="'连接状态: ' + props.connStatus" />
    </header>

    <nav class="nav">
      <div 
        class="nav-indicator-pill"
        :style="{ transform: `translateY(${activeNavIndex * 60}px)` }"
      />
      <button
        v-for="item in navItems"
        :key="item.key"
        class="nav-item"
        :class="{ 'nav-item--active': props.activeNav === item.key }"
        type="button"
        :title="item.label"
        @click="handleSelect(item.key)"
      >
        <component :is="item.icon" :size="22" stroke-width="2.2" class="nav-icon" />
        <small v-if="item.key === 'discover' && (props.discoverBadge || 0) > 0" class="nav-badge">
          {{ Math.min(props.discoverBadge || 0, 99) }}
        </small>
      </button>
    </nav>

    <footer class="sidebar-footer">
      <div class="profile-container relative">
        <canvas ref="particleCanvasRef" class="particle-canvas" />
        <button class="profile-btn" type="button" :title="props.userLabel" @click="handleAvatarClick">
          <img v-if="props.avatarUrl" :src="props.avatarUrl" class="profile-btn-img" alt="avatar" />
          <span v-else>{{ userInitial }}</span>
        </button>
      </div>
      <button class="logout" type="button" title="退出登录" @click="emit('logout')">
        <LogOut :size="20" stroke-width="2.2" />
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 76px;
  min-width: 76px;
  background: var(--c-bg-sidebar);
  backdrop-filter: var(--blur-lg);
  -webkit-backdrop-filter: var(--blur-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px;
  gap: 16px;
  box-shadow: 1px 0 12px rgba(0, 0, 0, 0.08);
  border-right: 1px solid rgba(255, 255, 255, 0.05); /* 利用透明白边强调质感 */
  z-index: 10;
}

.brand {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #00E583 0%, #00B164 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(0, 198, 112, 0.4);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  align-items: center;
}

.nav-item {
  position: relative;
  width: 48px;
  height: 48px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  padding: 0;
  cursor: pointer;
  color: var(--c-text-on-dark-muted);
  display: grid;
  place-items: center;
  transition: all var(--duration-fast) var(--ease-out);
  z-index: 2;
}

.nav-item:hover {
  color: #fff;
  transform: translateY(-2px);
}

.nav-item--active {
  color: var(--c-primary) !important;
}

.nav-indicator-pill {
  position: absolute;
  top: 0;
  left: 6px;
  width: 48px;
  height: 48px;
  background: rgba(0, 198, 112, 0.12);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 198, 112, 0.08);
  pointer-events: none;
  transition: transform 0.38s cubic-bezier(0.34, 1.66, 0.64, 1);
  z-index: 1;
}

.nav-indicator-pill::before {
  content: '';
  position: absolute;
  left: -14px;
  top: 12px;
  width: 3px;
  height: 24px;
  border-radius: 0 4px 4px 0;
  background: var(--c-primary);
  box-shadow: 0 0 8px var(--c-primary);
}

.nav-icon {
  font-size: 16px;
  font-weight: 700;
}

.nav-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  padding: 0 5px;
  display: inline-grid;
  place-items: center;
  background: var(--c-danger);
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  box-shadow: var(--shadow-sm);
  border: 2px solid var(--c-bg-sidebar); /* 加上边框，避免与背景融为一体 */
}

.sidebar-footer {
  margin-top: auto;
  display: grid;
  gap: 12px;
  width: 100%;
  place-items: center;
}

.profile-btn,
.logout {
  width: 44px;
  height: 44px;
  border: 1px solid var(--c-border-light);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.05);
  color: var(--c-text-on-dark);
  font-size: 14px;
  cursor: pointer;
  font-weight: bold;
  display: grid;
  place-items: center;
  transition: all var(--duration-fast) var(--ease-out);
}

.profile-btn {
  background: var(--c-primary-soft);
  border-color: rgba(0, 198, 112, 0.3);
  color: var(--c-primary);
  padding: 0;
  overflow: hidden;
}

.profile-btn-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--duration-fast) var(--ease-out);
}

.profile-btn:hover .profile-btn-img {
  transform: scale(1.1);
}

.profile-btn:hover {
  background: rgba(0, 198, 112, 0.25);
  transform: translateY(-2px);
}

.logout:hover {
  color: #fff;
  background: var(--c-bg-sidebar-active);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.status-dot {
  position: absolute;
  bottom: 0px;
  right: 0px;
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--c-bg-sidebar);
  transition: all 0.3s ease;
}

.status-dot--connected {
  background: var(--c-success);
  box-shadow: 0 0 6px var(--c-success);
}

.status-dot--connecting,
.status-dot--reconnecting {
  background: var(--c-warning);
  box-shadow: 0 0 6px var(--c-warning);
  animation: pulse-dot 1.5s infinite;
}

.status-dot--idle,
.status-dot--auth_failed {
  background: var(--c-danger);
  box-shadow: 0 0 6px var(--c-danger);
}

@keyframes pulse-dot {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}

.profile-container {
  position: relative;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
}

.particle-canvas {
  position: absolute;
  width: 120px;
  height: 120px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 10;
}
</style>
