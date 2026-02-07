import { extractBizCode, normalizeErrorMessage } from '../../shared/utils/error'

export type SecurityAction =
  | 'send_email_code'
  | 'change_email'
  | 'change_password'
  | 'delete_account'

const CODE_PARAM_ERROR = 10001
const CODE_TOO_MANY_REQUESTS = 10005
const CODE_UNAUTHORIZED = 20001
const CODE_INVALID_TOKEN = 20002
const CODE_TOKEN_EXPIRED = 20003
const CODE_PASSWORD_ERROR = 11003
const CODE_VERIFY_CODE_ERROR = 11006
const CODE_VERIFY_CODE_EXPIRE = 11007
const CODE_PASSWORD_SAME_AS_OLD = 11009
const CODE_EMAIL_ALREADY_EXIST = 11015
const CODE_VERIFY_CODE_TYPE_INVALID = 11018
const CODE_PASSWORD_FORMAT_ERROR = 11019
const CODE_INVALID_EMAIL = 11027
const CODE_SEND_TOO_FREQUENT = 11028
const CODE_ACCOUNT_DELETED = 11029

const SECURITY_ERROR_MESSAGES: Record<SecurityAction, Partial<Record<number, string>>> = {
  send_email_code: {
    [CODE_PARAM_ERROR]: '请输入正确的新邮箱地址。',
    [CODE_INVALID_EMAIL]: '新邮箱格式不正确。',
    [CODE_SEND_TOO_FREQUENT]: '验证码发送过于频繁，请稍后再试。',
    [CODE_TOO_MANY_REQUESTS]: '请求过于频繁，请稍后再试。',
    [CODE_VERIFY_CODE_TYPE_INVALID]: '验证码类型无效，请刷新后重试。',
    [CODE_ACCOUNT_DELETED]: '当前账号已注销，无法继续操作。'
  },
  change_email: {
    [CODE_PARAM_ERROR]: '请检查邮箱与验证码是否填写完整。',
    [CODE_INVALID_EMAIL]: '新邮箱格式不正确。',
    [CODE_EMAIL_ALREADY_EXIST]: '该邮箱已被使用，请更换后重试。',
    [CODE_VERIFY_CODE_ERROR]: '验证码错误，请重新输入。',
    [CODE_VERIFY_CODE_EXPIRE]: '验证码已过期，请重新获取。',
    [CODE_ACCOUNT_DELETED]: '当前账号已注销，无法继续操作。'
  },
  change_password: {
    [CODE_PARAM_ERROR]: '请检查旧密码和新密码格式。',
    [CODE_PASSWORD_ERROR]: '旧密码不正确，请重试。',
    [CODE_PASSWORD_SAME_AS_OLD]: '新密码不能与旧密码相同。',
    [CODE_PASSWORD_FORMAT_ERROR]: '密码格式不正确，请使用 8-16 位密码。',
    [CODE_ACCOUNT_DELETED]: '当前账号已注销，无法继续操作。'
  },
  delete_account: {
    [CODE_PARAM_ERROR]: '请检查密码或注销原因格式。',
    [CODE_PASSWORD_ERROR]: '密码错误，无法注销账号。',
    [CODE_ACCOUNT_DELETED]: '账号已处于注销状态。'
  }
}

function resolveAuthStatusMessage(code: number): string | null {
  if (code === CODE_UNAUTHORIZED || code === CODE_INVALID_TOKEN || code === CODE_TOKEN_EXPIRED) {
    return '登录状态失效，请重新登录。'
  }
  return null
}

export function resolveSecurityErrorMessage(action: SecurityAction, error: unknown): string {
  const code = extractBizCode(error)
  if (typeof code === 'number') {
    const authStatusMessage = resolveAuthStatusMessage(code)
    if (authStatusMessage) {
      return authStatusMessage
    }

    const actionMessage = SECURITY_ERROR_MESSAGES[action][code]
    if (actionMessage) {
      return actionMessage
    }
  }

  return normalizeErrorMessage(error)
}

export function isSendTooFrequentError(error: unknown): boolean {
  return extractBizCode(error) === CODE_SEND_TOO_FREQUENT
}
