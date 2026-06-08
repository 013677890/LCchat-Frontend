import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from './session.store'
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

const getMessagesMock = vi.fn().mockResolvedValue([])
const upsertMessagesMock = vi.fn().mockResolvedValue(undefined)
const getDraftMock = vi.fn().mockResolvedValue('')
const saveDraftMock = vi.fn().mockResolvedValue(undefined)

function setupWindowApi(): void {
  ;(globalThis as { window?: unknown }).window = {
    api: {
      localdb: {
        chat: {
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
    httpPostMock.mockResolvedValue({
      data: {
        data: {
          unreadCount: 0
        }
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
    expect(upsertMessagesMock).toHaveBeenCalledWith(
      'user-1',
      'conv-1',
      [
        expect.objectContaining({
          msgId: 'msg-1',
          status: 1,
          payload: expect.objectContaining({
            text: '消息已撤回'
          })
        })
      ]
    )
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
})
