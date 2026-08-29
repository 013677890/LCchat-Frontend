import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { buildP2PConversationId, useSessionStore } from './session.store'
import { httpClient } from '../shared/http/client'
import type { MessageRow } from '../../../shared/types/localdb'

vi.mock('../shared/http/client', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn()
  }
}))

const httpGetMock = httpClient.get as unknown as Mock
const httpPostMock = httpClient.post as unknown as Mock
const httpDeleteMock = httpClient.delete as unknown as Mock

const localdbInitMock = vi.fn().mockResolvedValue(undefined)
const getConversationsMock = vi.fn().mockResolvedValue([])
const upsertConversationsMock = vi.fn().mockResolvedValue(undefined)
const replaceConversationsMock = vi.fn().mockResolvedValue(undefined)
const getMessagesMock = vi.fn().mockResolvedValue([])
const defaultUpsertMessages = async (
  _userUuid: string,
  _convId: string,
  items: MessageRow[]
): Promise<{ insertedMsgIds: string[] }> => ({
  insertedMsgIds: items.map((item) => item.msgId)
})
const upsertMessagesMock = vi.fn().mockImplementation(defaultUpsertMessages)
const getDraftMock = vi.fn().mockResolvedValue('')
const saveDraftMock = vi.fn().mockResolvedValue(undefined)

function setupWindowApi(): void {
  ;(globalThis as { window?: unknown }).window = {
    api: {
      localdb: {
        init: localdbInitMock,
        chat: {
          getConversations: getConversationsMock,
          upsertConversations: upsertConversationsMock,
          replaceConversations: replaceConversationsMock,
          getMessages: getMessagesMock,
          upsertMessages: upsertMessagesMock,
          getDraft: getDraftMock,
          saveDraft: saveDraftMock
        }
      }
    }
  }
}

function backendMsg(seq: number): Record<string, unknown> {
  return {
    msgId: `msg-${seq}`,
    clientMsgId: `client-${seq}`,
    convId: 'conv-1',
    seq,
    fromUuid: 'peer-1',
    msgType: 1,
    content: JSON.stringify({ text: `hello-${seq}` }),
    status: 0,
    sendTime: 1000 + seq
  }
}

function cachedMsg(seq: number): MessageRow {
  return {
    userUuid: 'user-1',
    convId: 'conv-1',
    msgId: `cached-${seq}`,
    seq,
    sendTime: 900 + seq,
    payload: {
      text: `cached-${seq}`,
      from: 'peer'
    },
    status: 0
  }
}

describe('session.store message pull', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    setupWindowApi()
    localdbInitMock.mockResolvedValue(undefined)
    getConversationsMock.mockResolvedValue([])
    upsertConversationsMock.mockResolvedValue(undefined)
    replaceConversationsMock.mockResolvedValue(undefined)
    getMessagesMock.mockResolvedValue([])
    upsertMessagesMock.mockImplementation(defaultUpsertMessages)
    getDraftMock.mockResolvedValue('')
    saveDraftMock.mockResolvedValue(undefined)
    httpPostMock.mockResolvedValue({
      data: {
        data: {
          unreadCount: 0
        }
      }
    })
    httpDeleteMock.mockResolvedValue({
      data: {
        data: null
      }
    })
  })

  it('pulls the latest page with backward direction when local cache is empty', async () => {
    getMessagesMock.mockResolvedValueOnce([])
    httpGetMock.mockResolvedValueOnce({
      data: {
        data: {
          messages: [backendMsg(4), backendMsg(5)],
          hasMore: true,
          maxSeq: 5
        }
      }
    })

    const store = useSessionStore()
    store.currentUserUuid = 'user-1'

    await store.openConversation('conv-1')

    expect(httpGetMock).toHaveBeenCalledTimes(1)
    expect(httpGetMock).toHaveBeenCalledWith('/api/v1/auth/messages/pull', {
      params: {
        convId: 'conv-1',
        anchorSeq: 0,
        limit: 100,
        direction: 2
      }
    })
    expect(upsertMessagesMock).toHaveBeenCalledWith(
      'user-1',
      'conv-1',
      expect.arrayContaining([
        expect.objectContaining({ msgId: 'msg-4', seq: 4 }),
        expect.objectContaining({ msgId: 'msg-5', seq: 5 })
      ])
    )
  })

  it('builds stable p2p conversation ids from sorted participants', () => {
    expect(buildP2PConversationId('user-b', 'user-a')).toBe('p2p-user-a-user-b')
    expect(buildP2PConversationId('user-a', 'user-b')).toBe('p2p-user-a-user-b')
  })

  it('rejects starting a conversation before the current user is initialized', async () => {
    const store = useSessionStore()

    await expect(store.startConversation('peer-1', 1)).rejects.toThrow('缺少当前用户')
    expect(upsertConversationsMock).not.toHaveBeenCalled()
  })

  it('pulls newer messages from the local max seq when cache exists', async () => {
    getMessagesMock.mockResolvedValueOnce([cachedMsg(3)])
    httpGetMock.mockResolvedValueOnce({
      data: {
        data: {
          messages: [backendMsg(4)],
          hasMore: false,
          maxSeq: 4
        }
      }
    })

    const store = useSessionStore()
    store.currentUserUuid = 'user-1'

    await store.openConversation('conv-1')

    expect(httpGetMock).toHaveBeenCalledWith('/api/v1/auth/messages/pull', {
      params: {
        convId: 'conv-1',
        anchorSeq: 3,
        limit: 100,
        direction: 1
      }
    })
  })

  it('fills a websocket seq gap before returning the ack seq', async () => {
    getMessagesMock.mockResolvedValueOnce([cachedMsg(3)])
    httpGetMock.mockResolvedValueOnce({
      data: {
        data: {
          messages: [backendMsg(4), backendMsg(5)],
          hasMore: false,
          maxSeq: 5
        }
      }
    })

    const store = useSessionStore()
    store.currentUserUuid = 'user-1'
    store.activeConvId = 'conv-1'
    store.conversations = [
      {
        userUuid: 'user-1',
        convId: 'conv-1',
        payload: {
          unread: 0,
          preview: ''
        },
        updatedAt: 1
      }
    ]

    const ackSeq = await store.handleIncomingMessage('user-1', {
      ...backendMsg(5),
      fromUuid: 'user-1'
    })

    expect(httpGetMock).toHaveBeenCalledWith('/api/v1/auth/messages/pull', {
      params: {
        convId: 'conv-1',
        anchorSeq: 3,
        limit: 100,
        direction: 1
      }
    })
    expect(ackSeq).toBe(5)
    expect(upsertMessagesMock).toHaveBeenCalledWith(
      'user-1',
      'conv-1',
      expect.arrayContaining([
        expect.objectContaining({ msgId: 'msg-4', seq: 4 }),
        expect.objectContaining({ msgId: 'msg-5', seq: 5 })
      ])
    )
  })

  it('persists a pushed message before suppressing duplicate UI side effects', async () => {
    const existingMessage: MessageRow = {
      userUuid: 'user-1',
      convId: 'conv-1',
      msgId: 'msg-1',
      clientMsgId: 'client-1',
      seq: 1,
      sendTime: 1001,
      payload: { text: 'hello-1', from: 'peer-1' },
      status: 0
    }
    getMessagesMock.mockResolvedValueOnce([existingMessage])
    upsertMessagesMock.mockResolvedValueOnce({ insertedMsgIds: [] })

    const store = useSessionStore()
    store.currentUserUuid = 'user-1'
    store.conversations = [
      {
        userUuid: 'user-1',
        convId: 'conv-1',
        payload: { unread: 3, preview: 'hello-1' },
        updatedAt: 1
      }
    ]

    const ackSeq = await store.handleIncomingMessage('user-1', backendMsg(1))

    expect(upsertMessagesMock).toHaveBeenCalledWith('user-1', 'conv-1', [
      expect.objectContaining({ msgId: 'msg-1', seq: 1 })
    ])
    expect(store.conversations[0]?.payload.unread).toBe(3)
    expect(store.conversations[0]?.payload.preview).toBe('hello-1')
    expect(store.conversations[0]?.updatedAt).toBe(1)
    expect(ackSeq).toBe(1)
  })

  it('merges optimistic send, websocket echo and http confirmation by clientMsgId', async () => {
    const clientMsgId = '00000000-0000-4000-8000-000000000001'
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(clientMsgId)
    const store = useSessionStore()
    store.currentUserUuid = 'user-1'
    store.activeConvId = 'conv-1'
    store.conversations = [
      {
        userUuid: 'user-1',
        convId: 'conv-1',
        payload: {
          convType: 1,
          targetUuid: 'peer-1',
          unread: 0,
          preview: ''
        },
        updatedAt: 1
      }
    ]

    httpPostMock.mockImplementationOnce(async () => {
      await store.handleIncomingMessage('user-1', {
        ...backendMsg(1),
        msgId: 'msg-1',
        clientMsgId,
        fromUuid: 'user-1',
        sendTime: 1001
      })

      return {
        data: {
          data: {
            msgId: 'msg-1',
            seq: 1,
            sendTime: 1001
          }
        }
      }
    })

    await store.sendMessage('hello')

    expect(store.activeMessages).toHaveLength(1)
    expect(store.activeMessages[0]).toEqual(
      expect.objectContaining({
        msgId: 'msg-1',
        clientMsgId,
        seq: 1
      })
    )
  })

  it('waits for local persistence when recalling a loaded message', async () => {
    const store = useSessionStore()
    store.currentUserUuid = 'user-1'
    store.activeConvId = 'conv-1'
    store.conversations = [
      {
        userUuid: 'user-1',
        convId: 'conv-1',
        payload: {
          convType: 1,
          targetUuid: 'peer-1',
          unread: 0,
          preview: ''
        },
        updatedAt: 1
      }
    ]

    await store.handleIncomingMessage('user-1', {
      ...backendMsg(1),
      fromUuid: 'user-1'
    })

    vi.clearAllMocks()
    let writeFinished = false
    httpPostMock.mockResolvedValueOnce({ data: { data: null } })
    upsertMessagesMock.mockImplementationOnce(async () => {
      await Promise.resolve()
      writeFinished = true
    })

    await store.recallMessage('msg-1')

    expect(httpPostMock).toHaveBeenCalledWith('/api/v1/auth/messages/recall', {
      convId: 'conv-1',
      msgId: 'msg-1'
    })
    expect(writeFinished).toBe(true)
    expect(upsertMessagesMock).toHaveBeenCalledWith('user-1', 'conv-1', [
      expect.objectContaining({
        msgId: 'msg-1',
        status: 1,
        payload: expect.objectContaining({
          text: '消息已撤回'
        })
      })
    ])
    expect(store.activeMessages[0]).toEqual(
      expect.objectContaining({
        msgId: 'msg-1',
        status: 1,
        payload: expect.objectContaining({
          text: '消息已撤回'
        })
      })
    )
  })

  it('repairs a recalled message that is absent from the active cache', async () => {
    httpPostMock.mockResolvedValueOnce({
      data: {
        data: {
          messages: [
            {
              ...backendMsg(1),
              status: 1,
              content: JSON.stringify({ text: '对方撤回了一条消息' })
            }
          ]
        }
      }
    })

    const store = useSessionStore()
    store.currentUserUuid = 'user-1'

    await store.handleIncomingRecall('user-1', { convId: 'conv-1', msgId: 'msg-1' })

    expect(httpPostMock).toHaveBeenCalledWith('/api/v1/auth/messages/get-by-ids', {
      convId: 'conv-1',
      msgIds: ['msg-1']
    })
    expect(upsertMessagesMock).toHaveBeenCalledWith('user-1', 'conv-1', [
      expect.objectContaining({ msgId: 'msg-1', status: 1 })
    ])
  })

  it('reloads server-derived unread counts after another device marks a conversation as read', async () => {
    httpGetMock.mockResolvedValueOnce({
      data: {
        data: {
          conversations: [
            {
              convId: 'conv-1',
              convType: 1,
              targetUuid: 'peer-1',
              unreadCount: 2,
              updatedAt: 1
            }
          ],
          hasMore: false
        }
      }
    })

    const store = useSessionStore()
    store.currentUserUuid = 'user-1'
    store.conversations = [
      {
        userUuid: 'user-1',
        convId: 'conv-1',
        payload: { unread: 5, preview: '' },
        updatedAt: 1
      }
    ]

    await store.handleIncomingMarkRead('user-1', { convId: 'conv-1', readSeq: 3 })

    expect(httpGetMock).toHaveBeenCalledWith('/api/v1/auth/conversations', {
      params: { pageSize: 100 }
    })
    expect(store.conversations[0]?.payload.unread).toBe(2)
  })

  it('replaces the local conversation cache when server sync returns the full list', async () => {
    httpGetMock.mockResolvedValueOnce({
      data: {
        data: {
          conversations: [],
          hasMore: false
        }
      }
    })

    const store = useSessionStore()
    store.currentUserUuid = 'user-1'
    store.activeConvId = 'stale-conv'
    store.activeDraft = 'stale draft'
    store.conversations = [
      {
        userUuid: 'user-1',
        convId: 'stale-conv',
        payload: {
          unread: 0,
          preview: ''
        },
        updatedAt: 1
      }
    ]

    await store.syncConversationsFromServer('user-1')

    expect(replaceConversationsMock).toHaveBeenCalledWith('user-1', [])
    expect(store.conversations).toEqual([])
    expect(store.activeConvId).toBe('')
    expect(store.activeDraft).toBe('')
    expect(store.activeMessages).toEqual([])
  })

  it('persists conversation removal and loads the fallback conversation state', async () => {
    httpGetMock.mockResolvedValueOnce({
      data: {
        data: {
          messages: [],
          hasMore: false
        }
      }
    })
    getDraftMock.mockResolvedValueOnce('next draft')

    const store = useSessionStore()
    store.currentUserUuid = 'user-1'
    store.activeConvId = 'conv-1'
    store.activeDraft = 'old draft'
    store.conversations = [
      {
        userUuid: 'user-1',
        convId: 'conv-1',
        payload: {
          convType: 1,
          targetUuid: 'peer-1',
          unread: 0,
          preview: ''
        },
        updatedAt: 2
      },
      {
        userUuid: 'user-1',
        convId: 'conv-2',
        payload: {
          convType: 1,
          targetUuid: 'peer-2',
          unread: 0,
          preview: ''
        },
        updatedAt: 1
      }
    ]

    await store.deleteConv('conv-1')

    expect(httpDeleteMock).toHaveBeenCalledWith('/api/v1/auth/conversations/conv-1')
    expect(replaceConversationsMock).toHaveBeenCalledWith('user-1', [
      expect.objectContaining({ convId: 'conv-2' })
    ])
    expect(store.activeConvId).toBe('conv-2')
    expect(store.activeDraft).toBe('next draft')
    expect(store.activeMessages).toEqual([])
  })

  it('advances the peer read seq monotonically and ignores invalid receipts', async () => {
    const store = useSessionStore()

    store.handleIncomingReadReceipt({ convId: 'conv-1', readSeq: 5 })
    expect(store.peerReadSeqByConversation['conv-1']).toBe(5)

    // 乱序/重复回执不允许回退已读位点
    store.handleIncomingReadReceipt({ convId: 'conv-1', readSeq: 3 })
    expect(store.peerReadSeqByConversation['conv-1']).toBe(5)

    store.handleIncomingReadReceipt({ convId: 'conv-1', readSeq: 9 })
    expect(store.peerReadSeqByConversation['conv-1']).toBe(9)

    // 缺 convId 或非法 seq 的回执直接忽略
    store.handleIncomingReadReceipt({ convId: '', readSeq: 10 })
    store.handleIncomingReadReceipt({ convId: 'conv-2', readSeq: 0 })
    expect(store.peerReadSeqByConversation['conv-2']).toBeUndefined()

    // 退出登录清空所有已读位点
    await store.clearState()
    expect(store.peerReadSeqByConversation).toEqual({})
  })
})
