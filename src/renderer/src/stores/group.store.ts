import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth.store'
import {
  fetchGroupList,
  fetchGroupInfo,
  fetchGroupMembers,
  createGroup as apiCreateGroup,
  updateGroupInfo as apiUpdateGroupInfo,
  updateGroupNotice as apiUpdateGroupNotice,
  applyJoinGroup as apiApplyJoinGroup,
  cancelJoinGroupApplication as apiCancelJoinGroupApplication,
  fetchMyJoinGroupApplication as apiFetchMyJoinGroupApplication,
  fetchMyJoinGroupApplications as apiFetchMyJoinGroupApplications,
  fetchJoinRequests as apiFetchJoinRequests,
  fetchJoinRequestPendingCount as apiFetchJoinRequestPendingCount,
  fetchReviewedJoinRequests as apiFetchReviewedJoinRequests,
  reviewJoinGroup as apiReviewJoinGroup,
  transferGroupOwner as apiTransferGroupOwner,
  dismissGroup as apiDismissGroup,
  leaveGroup as apiLeaveGroup,
  addGroupMembers as apiAddGroupMembers,
  searchGroups as apiSearchGroups,
  searchGroupMembers as apiSearchGroupMembers,
  removeGroupMember as apiRemoveGroupMember,
  updateMyGroupNickname as apiUpdateMyGroupNickname,
  updateGroupMemberNickname as apiUpdateGroupMemberNickname,
  updateMemberRole as apiUpdateMemberRole,
  muteGroupMember as apiMuteGroupMember,
  updateGroupMuteSetting as apiUpdateGroupMuteSetting,
  fetchGroupMemberIDs as apiFetchGroupMemberIDs,
  type GroupInfoDTO,
  type GroupMemberItemDTO,
  type JoinRequestItemDTO,
  type ReviewedJoinRequestItemDTO,
  type MyJoinApplicationItemDTO
} from '../modules/group/api'

export const useGroupStore = defineStore('group', () => {
  const groups = shallowRef<GroupInfoDTO[]>([])
  const activeGroup = ref<GroupInfoDTO | null>(null)
  const activeMembers = shallowRef<GroupMemberItemDTO[]>([])
  const joinRequests = shallowRef<Record<string, JoinRequestItemDTO[]>>({})
  const pendingRequestsCount = ref<Record<string, number>>({})
  const myJoinApplications = shallowRef<MyJoinApplicationItemDTO[]>([])
  const loading = ref(false)

  const authStore = useAuthStore()

  function reset() {
    groups.value = []
    activeGroup.value = null
    activeMembers.value = []
    joinRequests.value = {}
    pendingRequestsCount.value = {}
    myJoinApplications.value = []
    loading.value = false
  }

  async function syncGroups() {
    if (!authStore.isAuthenticated) return
    loading.value = true
    try {
      const response = await fetchGroupList()
      groups.value = response.data.groups || []
      
      // If we have an active group, refresh its data too
      if (activeGroup.value) {
        const found = groups.value.find(g => g.groupUuid === activeGroup.value?.groupUuid)
        if (found) {
          activeGroup.value = found
        } else {
          activeGroup.value = null
          activeMembers.value = []
        }
      }
    } catch (error) {
      console.error('Failed to sync groups:', error)
    } finally {
      loading.value = false
    }
  }

  async function selectGroup(groupUuid: string) {
    loading.value = true
    try {
      const response = await fetchGroupInfo(groupUuid)
      activeGroup.value = response.data
      await syncMembers(groupUuid)
      await syncPendingCount(groupUuid)
    } catch (error) {
      console.error('Failed to fetch group info:', error)
      activeGroup.value = null
      activeMembers.value = []
    } finally {
      loading.value = false
    }
  }

  async function syncMembers(groupUuid: string) {
    try {
      const response = await fetchGroupMembers(groupUuid)
      activeMembers.value = response.data.members || []
    } catch (error) {
      console.error('Failed to fetch group members:', error)
    }
  }

  async function syncPendingCount(groupUuid: string) {
    try {
      const response = await apiFetchJoinRequestPendingCount(groupUuid)
      pendingRequestsCount.value = {
        ...pendingRequestsCount.value,
        [groupUuid]: Number(response.data.count) || 0
      }
    } catch (e) {
      // Ignore
    }
  }

  async function syncJoinRequests() {
    // If user owns or is admin of any groups, sync pending join requests
    for (const group of groups.value) {
      const isOwner = group.ownerUuid === authStore.userUuid
      const isAdmin = activeMembers.value.some(m => m.userUuid === authStore.userUuid && m.role === 1)
      if (isOwner || isAdmin) {
        try {
          const resp = await apiFetchJoinRequests(group.groupUuid, { page: 1, pageSize: 50 })
          joinRequests.value = {
            ...joinRequests.value,
            [group.groupUuid]: resp.data.items || []
          }
          await syncPendingCount(group.groupUuid)
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  async function createGroup(name: string, avatarUrl = '', memberUuids: string[] = []) {
    const response = await apiCreateGroup({ name, avatar: avatarUrl, memberUuids })
    await syncGroups()
    return response.data.groupUuid
  }

  async function updateInfo(groupUuid: string, name?: string, avatar?: string, addMode?: number) {
    await apiUpdateGroupInfo(groupUuid, { name, avatar, addMode })
    await syncGroups()
    if (activeGroup.value?.groupUuid === groupUuid) {
      await selectGroup(groupUuid)
    }
  }

  async function updateNotice(groupUuid: string, notice: string) {
    await apiUpdateGroupNotice(groupUuid, { notice })
    await syncGroups()
    if (activeGroup.value?.groupUuid === groupUuid) {
      activeGroup.value = {
        ...activeGroup.value,
        notice
      }
    }
  }

  async function applyJoin(groupUuid: string, reason?: string) {
    const response = await apiApplyJoinGroup(groupUuid, { reason })
    await syncGroups()
    return response.data
  }

  async function quitGroup(groupUuid: string) {
    await apiLeaveGroup(groupUuid)
    await syncGroups()
    if (activeGroup.value?.groupUuid === groupUuid) {
      activeGroup.value = null
      activeMembers.value = []
    }
  }

  async function dissolveGroup(groupUuid: string) {
    await apiDismissGroup(groupUuid)
    await syncGroups()
    if (activeGroup.value?.groupUuid === groupUuid) {
      activeGroup.value = null
      activeMembers.value = []
    }
  }

  async function inviteMembers(groupUuid: string, userUuids: string[]) {
    await apiAddGroupMembers(groupUuid, { userUuids })
    await syncMembers(groupUuid)
    await syncGroups()
  }

  async function kickMember(groupUuid: string, userUuid: string) {
    await apiRemoveGroupMember(groupUuid, userUuid)
    await syncMembers(groupUuid)
    await syncGroups()
  }

  async function reviewRequest(groupUuid: string, applyId: string | number, action: number, remark = '') {
    await apiReviewJoinGroup(groupUuid, applyId, { action, remark })
    await syncJoinRequests()
    await syncMembers(groupUuid)
    await syncGroups()
  }

  async function updateMyCard(groupUuid: string, cardName: string) {
    await apiUpdateMyGroupNickname(groupUuid, { groupNickname: cardName })
    await syncMembers(groupUuid)
  }

  async function updateMuteAll(groupUuid: string, muteAll: boolean) {
    await apiUpdateGroupMuteSetting(groupUuid, { muteAll })
    if (activeGroup.value?.groupUuid === groupUuid) {
      activeGroup.value = {
        ...activeGroup.value,
        muteAll
      }
    }
    await syncGroups()
  }

  async function muteMember(groupUuid: string, userUuid: string, durationMs: number) {
    const muteUntil = durationMs > 0 ? Date.now() + durationMs : 0
    await apiMuteGroupMember(groupUuid, userUuid, { muteUntil })
    await syncMembers(groupUuid)
  }

  async function updateRole(groupUuid: string, userUuid: string, role: number) {
    await apiUpdateMemberRole(groupUuid, userUuid, { role })
    await syncMembers(groupUuid)
  }

  async function transferOwner(groupUuid: string, targetUserUuid: string) {
    await apiTransferGroupOwner(groupUuid, { targetUserUuid })
    await syncGroups()
    if (activeGroup.value?.groupUuid === groupUuid) {
      await selectGroup(groupUuid)
    }
  }

  async function syncMyJoinApplications() {
    try {
      const resp = await apiFetchMyJoinGroupApplications({ page: 1, pageSize: 50 })
      myJoinApplications.value = resp.data.items || []
    } catch (e) {
      console.error(e)
    }
  }

  async function syncJoinRequestsForGroup(groupUuid: string) {
    try {
      const resp = await apiFetchJoinRequests(groupUuid, { page: 1, pageSize: 50 })
      joinRequests.value = {
        ...joinRequests.value,
        [groupUuid]: resp.data.items || []
      }
      await syncPendingCount(groupUuid)
    } catch (e) {
      console.error('Failed to sync join requests for group:', e)
    }
  }

  return {
    groups,
    activeGroup,
    activeMembers,
    joinRequests,
    pendingRequestsCount,
    myJoinApplications,
    loading,
    reset,
    syncGroups,
    selectGroup,
    syncMembers,
    syncJoinRequests,
    syncJoinRequestsForGroup,
    createGroup,
    updateInfo,
    updateNotice,
    applyJoin,
    quitGroup,
    dissolveGroup,
    inviteMembers,
    kickMember,
    reviewRequest,
    updateMyCard,
    updateMuteAll,
    muteMember,
    updateRole,
    transferOwner,
    syncMyJoinApplications
  }
})
