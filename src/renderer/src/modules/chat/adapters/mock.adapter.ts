import type { MessageRow } from '../../../shared/types/localdb'
import type { ChatAdapter } from '../api'

export const mockChatAdapter: ChatAdapter = {
  async getHistory(_convId: string, _cursor?: number, _limit?: number): Promise<MessageRow[]> {
    return []
  },
  async sendMessage(_convId: string, _text: string): Promise<void> {
    return Promise.resolve()
  }
}
