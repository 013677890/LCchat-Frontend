import { extractBizCode, normalizeErrorMessage } from '../../shared/utils/error'

export type RelationAction = 'delete_friend' | 'add_blacklist' | 'remove_blacklist'

const CODE_PARAM_ERROR = 10001
const CODE_TOO_MANY_REQUESTS = 10005
const CODE_UNAUTHORIZED = 20001
const CODE_INVALID_TOKEN = 20002
const CODE_TOKEN_EXPIRED = 20003
const CODE_USER_NOT_FOUND = 11001
const CODE_NOT_FRIEND = 12003
const CODE_NO_PERMISSION = 14003
const CODE_PEER_BLACKLIST_YOU = 16001
const CODE_YOU_BLACKLIST_PEER = 16002
const CODE_ALREADY_IN_BLACKLIST = 16003
const CODE_NOT_IN_BLACKLIST = 16004
const CODE_CANNOT_BLACKLIST_SELF = 16005

const RELATION_ERROR_MESSAGES: Record<RelationAction, Partial<Record<number, string>>> = {
  delete_friend: {
    [CODE_PARAM_ERROR]: '请求参数无效，请刷新后重试。',
    [CODE_USER_NOT_FOUND]: '目标用户不存在。',
    [CODE_NOT_FRIEND]: '当前已不是好友关系。',
    [CODE_NO_PERMISSION]: '无权限执行删除操作。',
    [CODE_TOO_MANY_REQUESTS]: '操作过于频繁，请稍后重试。'
  },
  add_blacklist: {
    [CODE_PARAM_ERROR]: '请求参数无效，请刷新后重试。',
    [CODE_USER_NOT_FOUND]: '目标用户不存在。',
    [CODE_ALREADY_IN_BLACKLIST]: '对方已在黑名单中。',
    [CODE_CANNOT_BLACKLIST_SELF]: '不能将自己加入黑名单。',
    [CODE_PEER_BLACKLIST_YOU]: '对方已将你拉黑。',
    [CODE_YOU_BLACKLIST_PEER]: '你已将对方拉黑。',
    [CODE_TOO_MANY_REQUESTS]: '操作过于频繁，请稍后重试。'
  },
  remove_blacklist: {
    [CODE_PARAM_ERROR]: '请求参数无效，请刷新后重试。',
    [CODE_USER_NOT_FOUND]: '目标用户不存在。',
    [CODE_NOT_IN_BLACKLIST]: '目标用户不在黑名单中。',
    [CODE_TOO_MANY_REQUESTS]: '操作过于频繁，请稍后重试。'
  }
}

function resolveAuthStatusMessage(code: number): string | null {
  if (code === CODE_UNAUTHORIZED || code === CODE_INVALID_TOKEN || code === CODE_TOKEN_EXPIRED) {
    return '登录状态失效，请重新登录。'
  }
  return null
}

export function resolveRelationErrorMessage(action: RelationAction, error: unknown): string {
  const code = extractBizCode(error)
  if (typeof code === 'number') {
    const authStatusMessage = resolveAuthStatusMessage(code)
    if (authStatusMessage) {
      return authStatusMessage
    }

    const actionMessage = RELATION_ERROR_MESSAGES[action][code]
    if (actionMessage) {
      return actionMessage
    }
  }

  return normalizeErrorMessage(error)
}
