import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { SessionData } from '../../../shared/types/localdb'
import {
  login,
  loginByCode,
  register,
  resetPassword,
  sendVerifyCode,
  type LoginByCodeResponseData,
  type LoginResponseData,
  type RegisterRequest,
  type ResetPasswordRequest,
  type VerifyCodeType
} from '../modules/auth/api'
import { logout } from '../modules/security/api'

function createDemoSession(userUuid: string, deviceId: string): SessionData {
  return {
    userUuid,
    accessToken: `demo_access_${userUuid}`,
    refreshToken: `demo_refresh_${userUuid}`,
    expiresAt: Date.now() + 60 * 60 * 1000,
    deviceId
  }
}

function buildSessionFromLoginResponse(payload: LoginResponseData, deviceId: string): SessionData {
  const userUuid = payload.userInfo?.uuid
  if (!userUuid) {
    throw new Error('登录响应缺少用户信息')
  }

  return {
    userUuid,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresAt: Date.now() + Math.max(0, payload.expiresIn) * 1000,
    deviceId
  }
}

function buildSessionFromCodeLoginResponse(
  payload: LoginByCodeResponseData,
  deviceId: string
): SessionData {
  const userUuid = payload.userInfo?.uuid
  if (!userUuid) {
    throw new Error('验证码登录响应缺少用户信息')
  }

  return {
    userUuid,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresAt: Date.now() + Math.max(0, payload.expiresIn) * 1000,
    deviceId
  }
}

export const useAuthStore = defineStore('auth', () => {
  const session = shallowRef<SessionData | null>(null)
  const hydrated = ref(false)

  const isAuthenticated = computed(() => Boolean(session.value?.accessToken))
  const userUuid = computed(() => session.value?.userUuid ?? '')

  async function hydrateSession(): Promise<void> {
    if (hydrated.value) {
      return
    }

    session.value = await window.api.session.get()
    hydrated.value = true
  }

  async function signIn(nextSession: SessionData): Promise<void> {
    session.value = nextSession
    await window.api.session.set(nextSession)
    try {
      await window.api.localdb.init()
    } catch (error) {
      console.warn('localdb init failed, continue with in-memory mode', error)
    }
  }

  async function signInWithDemoAccount(userInput: string): Promise<void> {
    const deviceId = await window.api.device.getId()
    const normalizedUser = userInput.trim() || 'demo-user'
    await signIn(createDemoSession(normalizedUser, deviceId))
  }

  async function signInWithPassword(account: string, password: string): Promise<void> {
    const normalizedAccount = account.trim()
    if (!normalizedAccount || !password) {
      throw new Error('请输入账号和密码')
    }

    const deviceId = await window.api.device.getId()
    const response = await login({
      account: normalizedAccount,
      password
    })

    const nextSession = buildSessionFromLoginResponse(response.data, deviceId)
    await signIn(nextSession)
  }

  async function signInWithCode(email: string, verifyCode: string): Promise<void> {
    const normalizedEmail = email.trim()
    const normalizedCode = verifyCode.trim()
    if (!normalizedEmail || !normalizedCode) {
      throw new Error('请输入邮箱和验证码')
    }

    const deviceId = await window.api.device.getId()
    const response = await loginByCode({
      email: normalizedEmail,
      verifyCode: normalizedCode
    })

    const nextSession = buildSessionFromCodeLoginResponse(response.data, deviceId)
    await signIn(nextSession)
  }

  async function registerWithEmail(payload: RegisterRequest): Promise<void> {
    const normalizedEmail = payload.email.trim()
    const normalizedCode = payload.verifyCode.trim()
    const normalizedPassword = payload.password
    if (!normalizedEmail || !normalizedCode || !normalizedPassword) {
      throw new Error('请填写完整的注册信息')
    }

    await register({
      email: normalizedEmail,
      verifyCode: normalizedCode,
      password: normalizedPassword,
      nickname: payload.nickname?.trim() || undefined,
      telephone: payload.telephone?.trim() || undefined
    })
  }

  async function requestVerifyCode(email: string, type: VerifyCodeType): Promise<number> {
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      throw new Error('请输入邮箱')
    }

    const response = await sendVerifyCode({
      email: normalizedEmail,
      type
    })
    return Number(response.data.expireSeconds) || 60
  }

  async function resetPasswordByEmail(payload: ResetPasswordRequest): Promise<void> {
    const normalizedEmail = payload.email.trim()
    const normalizedCode = payload.verifyCode.trim()
    const normalizedPassword = payload.newPassword
    if (!normalizedEmail || !normalizedCode || !normalizedPassword) {
      throw new Error('请填写完整的重置信息')
    }

    await resetPassword({
      email: normalizedEmail,
      verifyCode: normalizedCode,
      newPassword: normalizedPassword
    })
  }

  async function signOut(): Promise<void> {
    const currentSession = session.value
    if (currentSession?.deviceId) {
      try {
        await logout(currentSession.deviceId)
      } catch (error) {
        console.warn('server logout failed, continue local signout', error)
      }
    }

    session.value = null
    await window.api.session.clear()
  }

  return {
    session,
    hydrated,
    isAuthenticated,
    userUuid,
    hydrateSession,
    signIn,
    signInWithDemoAccount,
    signInWithPassword,
    signInWithCode,
    registerWithEmail,
    requestVerifyCode,
    resetPasswordByEmail,
    signOut
  }
})
