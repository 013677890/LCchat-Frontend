import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGroupStore } from './group.store'
import {
  fetchJoinRequestPendingCount,
  fetchJoinRequests,
  fetchMyJoinGroupApplications,
  updateGroupNotice
} from '../modules/group/api'

vi.mock('../modules/group/api', () => ({
  addGroupMembers: vi.fn(),
  applyJoinGroup: vi.fn(),
  cancelJoinGroupApplication: vi.fn(),
  createGroup: vi.fn(),
  dismissGroup: vi.fn(),
  fetchGroupInfo: vi.fn(),
  fetchGroupList: vi.fn(),
  fetchGroupMemberIDs: vi.fn(),
  fetchGroupMembers: vi.fn(),
  fetchJoinRequestPendingCount: vi.fn(),
  fetchJoinRequests: vi.fn(),
  fetchMyJoinGroupApplication: vi.fn(),
  fetchMyJoinGroupApplications: vi.fn(),
  fetchReviewedJoinRequests: vi.fn(),
  leaveGroup: vi.fn(),
  muteGroupMember: vi.fn(),
  removeGroupMember: vi.fn(),
  reviewJoinGroup: vi.fn(),
  searchGroupMembers: vi.fn(),
  searchGroups: vi.fn(),
  transferGroupOwner: vi.fn(),
  updateGroupInfo: vi.fn(),
  updateGroupMemberNickname: vi.fn(),
  updateGroupMuteSetting: vi.fn(),
  updateGroupNotice: vi.fn(),
  updateMemberRole: vi.fn(),
  updateMyGroupNickname: vi.fn()
}))

const fetchJoinRequestsMock = vi.mocked(fetchJoinRequests)
const fetchPendingCountMock = vi.mocked(fetchJoinRequestPendingCount)
const fetchMyJoinApplicationsMock = vi.mocked(fetchMyJoinGroupApplications)
const updateGroupNoticeMock = vi.mocked(updateGroupNotice)

describe('group.store pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    fetchPendingCountMock.mockResolvedValue({
      data: {
        count: 51
      }
    } as never)
  })

  it('loads every pending join-request page for a group', async () => {
    fetchJoinRequestsMock
      .mockResolvedValueOnce({
        data: {
          items: Array.from({ length: 50 }, (_, index) => ({
            applyId: index + 1,
            applicantUuid: `user-${index + 1}`,
            nickname: `user-${index + 1}`,
            avatar: '',
            reason: '',
            createdAt: index + 1
          })),
          total: 51,
          page: 1,
          pageSize: 50
        }
      } as never)
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              applyId: 51,
              applicantUuid: 'user-51',
              nickname: 'user-51',
              avatar: '',
              reason: '',
              createdAt: 51
            }
          ],
          total: 51,
          page: 2,
          pageSize: 50
        }
      } as never)

    const store = useGroupStore()
    await store.syncJoinRequestsForGroup('group-1')

    expect(fetchJoinRequestsMock).toHaveBeenCalledTimes(2)
    expect(fetchJoinRequestsMock).toHaveBeenNthCalledWith(1, 'group-1', {
      page: 1,
      pageSize: 50
    })
    expect(fetchJoinRequestsMock).toHaveBeenNthCalledWith(2, 'group-1', {
      page: 2,
      pageSize: 50
    })
    expect(store.joinRequests['group-1']).toHaveLength(51)
    expect(store.pendingRequestsCount['group-1']).toBe(51)
  })

  it('loads every page of my join applications', async () => {
    fetchMyJoinApplicationsMock
      .mockResolvedValueOnce({
        data: {
          items: Array.from({ length: 50 }, (_, index) => ({
            applyId: index + 1,
            groupUuid: `group-${index + 1}`,
            groupName: `group-${index + 1}`,
            groupAvatar: '',
            status: 0,
            reason: '',
            reviewerUuid: '',
            reviewRemark: '',
            createdAt: index + 1,
            reviewedAt: 0
          })),
          total: '52',
          page: 1,
          pageSize: 50
        }
      } as never)
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              applyId: 51,
              groupUuid: 'group-51',
              groupName: 'group-51',
              groupAvatar: '',
              status: 0,
              reason: '',
              reviewerUuid: '',
              reviewRemark: '',
              createdAt: 51,
              reviewedAt: 0
            },
            {
              applyId: 52,
              groupUuid: 'group-52',
              groupName: 'group-52',
              groupAvatar: '',
              status: 0,
              reason: '',
              reviewerUuid: '',
              reviewRemark: '',
              createdAt: 52,
              reviewedAt: 0
            }
          ],
          total: '52',
          page: 2,
          pageSize: 50
        }
      } as never)

    const store = useGroupStore()
    await store.syncMyJoinApplications()

    expect(fetchMyJoinApplicationsMock).toHaveBeenCalledTimes(2)
    expect(store.myJoinApplications).toHaveLength(52)
  })

  it('updates the group list and active group after saving a notice', async () => {
    updateGroupNoticeMock.mockResolvedValue({ data: null } as never)
    const group = {
      groupUuid: 'group-1',
      name: '测试群',
      avatar: '',
      notice: '旧公告',
      ownerUuid: 'user-1',
      memberCount: 2,
      addMode: 0,
      muteAll: false
    }
    const store = useGroupStore()
    store.groups = [group]
    store.activeGroup = group

    await store.updateNotice('group-1', '新公告')

    expect(updateGroupNoticeMock).toHaveBeenCalledWith('group-1', { notice: '新公告' })
    expect(store.groups[0]?.notice).toBe('新公告')
    expect(store.activeGroup?.notice).toBe('新公告')
  })
})
