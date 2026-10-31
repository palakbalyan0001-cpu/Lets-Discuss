import { api } from "./axios"

export const createWorkspaces = (data) => api.post("/workspaces/create", data)
export const getMyWorkspaces = () => api.get("/workspaces")
export const getWorkspace = (id) => api.get(`/workspaces/${id}`)
export const deleteWorkspace = (id) => api.delete(`/workspaces/${id}`)
export const leaveWorkspace = (id) => api.post(`/workspaces/${id}/leave`)
export const inviteMembers = (id, emails) => api.post(`/workspaces/${id}/invite`, { emails })
export const getInviteInfo = (code) => api.get(`/workspaces/invite/${code}`)
export const joinWorkspace = (code) => api.post(`/workspaces/join/${code}`)
export const createChannel = (id, name, description = "") => api.post(`/workspaces/${id}/channels`, { name, description })
export const setMemberRole = (id, userId, role) => api.patch(`/workspaces/${id}/members/${userId}`, { role })
export const removeMember = (id, userId) => api.delete(`/workspaces/${id}/members/${userId}`)
