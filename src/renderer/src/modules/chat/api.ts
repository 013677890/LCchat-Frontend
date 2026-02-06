import type { MessageRow } from '../../shared/types/localdb'

export interface ChatAdapter {
  getHistory: (convId: string, cursor?: number, limit?: number) => Promise<MessageRow[]>
  sendMessage: (convId: string, text: string) => Promise<void>
}
