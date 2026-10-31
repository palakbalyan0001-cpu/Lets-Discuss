import { api, API_URL } from "./axios"

const base = (kind) => (kind === "channel" ? "/channels" : "/dms")

export const getMessages = (kind, id) => api.get(`${base(kind)}/${id}/messages`)
export const markRead = (kind, id) => api.post(`${base(kind)}/${id}/read`)
export const editMessage = (id, text) => api.patch(`/messages/${id}`, { text })
export const deleteMessage = (id) => api.delete(`/messages/${id}`)
export const uploadFile = (kind, id, file, text, onProgress) => {
    const fd = new FormData()
    fd.append("kind", kind)
    fd.append("id", id)
    fd.append("text", text || "")
    fd.append("file", file)
    return api.post("/messages/upload", fd, {
        onUploadProgress: (e) => onProgress && e.total && onProgress(Math.round((e.loaded / e.total) * 100)),
    })
}
export const fileUrl = (messageId, download = false) => `${API_URL}/files/${messageId}${download ? "?download=1" : ""}`

export const createOrGetDm = (workspaceId, userIds) => api.post(`/workspaces/${workspaceId}/dms`, { userIds })
export const searchWorkspace = (params) => api.get("/search", { params })

export const joinChannel = (id) => api.post(`/channels/${id}/join`)
export const leaveChannel = (id) => api.post(`/channels/${id}/leave`)
export const deleteChannel = (id) => api.delete(`/channels/${id}`)

export const getGithub = (channelId) => api.get(`/channels/${channelId}/github`)
export const linkGithub = (channelId, repo) => api.put(`/channels/${channelId}/github`, { repo })
export const unlinkGithub = (channelId) => api.delete(`/channels/${channelId}/github`)
export const getGithubWebhook = (channelId) => api.get(`/channels/${channelId}/github/webhook`)
