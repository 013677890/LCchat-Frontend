import type { MessageRow } from '../../../shared/types/localdb'
import type { ChatAdapter } from '../api'

export const backendChatAdapter: ChatAdapter = {
  async getHistory(_convId: string, _cursor?: number, _limit?: number): Promise<MessageRow[]> {
    throw new Error('消息后端尚未接入，当前版本仅支持本地缓存回显')
  },
  async sendMessage(_convId: string, _text: string): Promise<void> {
    throw new Error('消息后端尚未接入，当前版本仅支持本地缓存回显')
  }
}
