import { extractBizCode, normalizeErrorMessage } from '../../shared/utils/error'

export type AuthAction =
  | 'password_login'
  | 'code_login'
  | 'register'
  | 'send_code'
  | 'verify_code'
  | 'reset_password'

const CODE_PARAM_ERROR = 10001
const CODE_TOO_MANY_REQUESTS = 10005
const CODE_UNAUTHORIZED = 20001
const CODE_INVALID_TOKEN = 20002
const CODE_TOKEN_EXPIRED = 20003
const CODE_USER_NOT_FOUND = 11001
const CODE_USER_ALREADY_EXIST = 11002
const CODE_PASSWORD_ERROR = 11003
const CODE_EMAIL_FORMAT_ERROR = 11005
const CODE_VERIFY_CODE_ERROR = 11006
const CODE_VERIFY_CODE_EXPIRE = 11007
const CODE_EMAIL_ALREADY_EXIST = 11015
const CODE_ACCOUNT_NOT_FOUND = 11017
const CODE_VERIFY_CODE_TYPE_INVALID = 11018
const CODE_PASSWORD_FORMAT_ERROR = 11019
const CODE_EMAIL_NOT_FOUND = 11026
const CODE_INVALID_EMAIL = 11027
const CODE_SEND_TOO_FREQUENT = 11028
const CODE_ACCOUNT_DELETED = 11029

const AUTH_ERROR_MESSAGES: Record<AuthAction, Partial<Record<number, string>>> = {
  password_login: {
    [CODE_PARAM_ERROR]: '请输入账号和密码。',
    [CODE_PASSWORD_ERROR]: '账号或密码错误，请重试。',
    [CODE_ACCOUNT_NOT_FOUND]: '账号不存在，请检查后重试。',
    [CODE_ACCOUNT_DELETED]: '账号已注销，暂不可登录。'
  },
  code_login: {
    [CODE_PARAM_ERROR]: '请检查邮箱与验证码格式。',
    [CODE_INVALID_EMAIL]: '邮箱格式不正确。',
    [CODE_VERIFY_CODE_ERROR]: '验证码错误，请重新输入。',
    [CODE_VERIFY_CODE_EXPIRE]: '验证码已过期，请重新获取。',
    [CODE_EMAIL_NOT_FOUND]: '邮箱未注册，请先注册账号。',
    [CODE_ACCOUNT_DELETED]: '账号已注销，暂不可登录。'
  },
  register: {
    [CODE_PARAM_ERROR]: '请填写完整且正确的注册信息。',
    [CODE_INVALID_EMAIL]: '邮箱格式不正确。',
    [CODE_VERIFY_CODE_ERROR]: '验证码错误，请重新输入。',
    [CODE_VERIFY_CODE_EXPIRE]: '验证码已过期，请重新获取。',
    [CODE_EMAIL_ALREADY_EXIST]: '该邮箱已注册，请直接登录。',
    [CODE_USER_ALREADY_EXIST]: '用户已存在，请直接登录。',
    [CODE_PASSWORD_FORMAT_ERROR]: '密码格式不正确，请使用 6-20 位密码。'
  },
  send_code: {
    [CODE_PARAM_ERROR]: '请输入正确的邮箱地址。',
    [CODE_INVALID_EMAIL]: '邮箱格式不正确。',
    [CODE_EMAIL_FORMAT_ERROR]: '邮箱格式不正确。',
    [CODE_SEND_TOO_FREQUENT]: '验证码发送过于频繁，请稍后再试。',
    [CODE_TOO_MANY_REQUESTS]: '请求过于频繁，请稍后再试。',
    [CODE_VERIFY_CODE_TYPE_INVALID]: '验证码类型无效，请刷新页面后重试。',
    [CODE_ACCOUNT_DELETED]: '当前账号已注销，无法继续操作。'
  },
  verify_code: {
    [CODE_PARAM_ERROR]: '请检查邮箱和验证码格式。',
    [CODE_INVALID_EMAIL]: '邮箱格式不正确。',
    [CODE_VERIFY_CODE_ERROR]: '验证码错误，请重新输入。',
    [CODE_VERIFY_CODE_EXPIRE]: '验证码已过期，请重新获取。'
  },
  reset_password: {
    [CODE_PARAM_ERROR]: '请填写完整的重置密码信息。',
    [CODE_INVALID_EMAIL]: '邮箱格式不正确。',
    [CODE_VERIFY_CODE_ERROR]: '验证码错误，请重新输入。',
    [CODE_VERIFY_CODE_EXPIRE]: '验证码已过期，请重新获取。',
    [CODE_EMAIL_NOT_FOUND]: '邮箱未注册，无法重置密码。',
    [CODE_PASSWORD_FORMAT_ERROR]: '新密码格式不正确，请使用 6-20 位密码。',
    [CODE_ACCOUNT_DELETED]: '账号已注销，无法重置密码。'
  }
}

function resolveAuthStatusMessage(code: number): string | null {
  if (code === CODE_UNAUTHORIZED || code === CODE_INVALID_TOKEN || code === CODE_TOKEN_EXPIRED) {
    return '登录状态失效，请重新登录。'
  }
  return null
}

export function resolveAuthErrorMessage(action: AuthAction, error: unknown): string {
  const code = extractBizCode(error)
  if (typeof code === 'number') {
    const authStatusMessage = resolveAuthStatusMessage(code)
    if (authStatusMessage) {
      return authStatusMessage
    }

    const actionMessage = AUTH_ERROR_MESSAGES[action][code]
    if (actionMessage) {
      return actionMessage
    }
  }

  return normalizeErrorMessage(error)
}
