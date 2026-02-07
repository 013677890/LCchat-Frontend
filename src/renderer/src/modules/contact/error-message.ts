import { extractBizCode, normalizeErrorMessage } from '../../shared/utils/error'

export type RelationAction =
  | 'send_friend_apply'
  | 'delete_friend'
  | 'add_blacklist'
  | 'remove_blacklist'
  | 'set_friend_remark'
  | 'set_friend_tag'

const CODE_PARAM_ERROR = 10001
const CODE_TOO_MANY_REQUESTS = 10005
const CODE_UNAUTHORIZED = 20001
const CODE_INVALID_TOKEN = 20002
const CODE_TOKEN_EXPIRED = 20003
const CODE_USER_NOT_FOUND = 11001
const CODE_ALREADY_FRIEND = 12001
const CODE_FRIEND_REQUEST_SENT = 12002
const CODE_NOT_FRIEND = 12003
const CODE_CANNOT_ADD_SELF = 12007
const CODE_FRIEND_LIMIT_EXCEEDED = 12008
const CODE_REMARK_TOO_LONG = 11024
const CODE_NO_PERMISSION = 14003
const CODE_PEER_BLACKLIST_YOU = 16001
const CODE_YOU_BLACKLIST_PEER = 16002
const CODE_ALREADY_IN_BLACKLIST = 16003
const CODE_NOT_IN_BLACKLIST = 16004
const CODE_CANNOT_BLACKLIST_SELF = 16005
const CODE_TAG_NAME_INVALID = 12010

const RELATION_ERROR_MESSAGES: Record<RelationAction, Partial<Record<number, string>>> = {
  send_friend_apply: {
    [CODE_PARAM_ERROR]: '搜索参数或申请参数不正确。',
    [CODE_USER_NOT_FOUND]: '目标用户不存在。',
    [CODE_ALREADY_FRIEND]: '对方已经是你的好友。',
    [CODE_FRIEND_REQUEST_SENT]: '好友申请已发送，请勿重复提交。',
    [CODE_CANNOT_ADD_SELF]: '不能添加自己为好友。',
    [CODE_FRIEND_LIMIT_EXCEEDED]: '好友数量已达上限。',
    [CODE_PEER_BLACKLIST_YOU]: '对方已将你拉黑，无法发送申请。',
    [CODE_YOU_BLACKLIST_PEER]: '你已将对方拉黑，请先移出黑名单。',
    [CODE_TOO_MANY_REQUESTS]: '操作过于频繁，请稍后重试。'
  },
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
  },
  set_friend_remark: {
    [CODE_PARAM_ERROR]: '备注格式不正确，请检查后重试。',
    [CODE_USER_NOT_FOUND]: '目标用户不存在。',
    [CODE_NOT_FRIEND]: '当前已不是好友关系。',
    [CODE_REMARK_TOO_LONG]: '备注长度超出限制。',
    [CODE_NO_PERMISSION]: '无权限修改该好友备注。',
    [CODE_TOO_MANY_REQUESTS]: '操作过于频繁，请稍后重试。'
  },
  set_friend_tag: {
    [CODE_PARAM_ERROR]: '标签格式不正确，请检查后重试。',
    [CODE_USER_NOT_FOUND]: '目标用户不存在。',
    [CODE_NOT_FRIEND]: '当前已不是好友关系。',
    [CODE_TAG_NAME_INVALID]: '标签名称无效，请重新输入。',
    [CODE_NO_PERMISSION]: '无权限修改该好友标签。',
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
