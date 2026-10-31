import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { FaBars, FaGithub, FaHashtag, FaSearch, FaUsers, FaVideo } from "react-icons/fa"

import { socket } from "../../api/socket"
import * as ws from "../../api/workspaces"
import * as chat from "../../api/chat"
import { getErrorMessage } from "../../api/axios"
import { logoutUser } from "../../store/authSlice"
import { deleteWorkspace, leaveWorkspace } from "../../store/workspacesSlice"
import useCall from "../../hooks/useCall"
import { dmLabel } from "../../utils/chat"

import Sidebar from "../../components/chat/Sidebar"
import MessageList from "../../components/chat/MessageList"
import MessageInput from "../../components/chat/MessageInput"
import MembersPanel from "../../components/chat/MembersPanel"
import GithubPanel from "../../components/chat/GithubPanel"
import CallOverlay from "../../components/chat/CallOverlay"
import { BrowseChannelsModal, InviteModal, NewChannelModal, NewDmModal, SearchModal } from "../../components/chat/Modals"

const upsertById = (list, item) => (list.some((x) => x._id === item._id) ? list : [...list, item])

export default function Dashboard() {
    const { id } = useParams()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const user = useSelector((s) => s.auth.user)

    const [workspace, setWorkspace] = useState(null)
    const [channels, setChannels] = useState([])
    const [members, setMembers] = useState([])
    const [dms, setDms] = useState([])
    const [unread, setUnread] = useState({})
    const [active, setActive] = useState(null) // { kind: "channel" | "dm", id }
    const [messages, setMessages] = useState([])
    const [typing, setTyping] = useState({})
    const [sendError, setSendError] = useState("")
    const [error, setError] = useState("")
    const [connected, setConnected] = useState(false)
    const [activeCalls, setActiveCalls] = useState({}) // "kind:id" -> { by }
    const [toasts, setToasts] = useState([])
    const [panel, setPanel] = useState(null) // "members" | "github" | null
    const [modal, setModal] = useState(null) // "channel" | "browse" | "dm" | "invite" | "search" | null
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [notifPerm, setNotifPerm] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission)

    const call = useCall()

    // refs so socket handlers always see fresh values without re-subscribing
    const activeRef = useRef(null)
    const channelsRef = useRef([])
    const dmsRef = useRef([])
    const roleRef = useRef("member")
    const typingTimers = useRef({})
    useEffect(() => { activeRef.current = active }, [active])
    useEffect(() => { channelsRef.current = channels }, [channels])
    useEffect(() => { dmsRef.current = dms }, [dms])
    useEffect(() => { roleRef.current = workspace?.myRole || "member" }, [workspace])

    const pushToast = useCallback((toast) => {
        const tid = Math.random().toString(36).slice(2)
        setToasts((t) => [...t.slice(-3), { ...toast, tid }])
        setTimeout(() => setToasts((t) => t.filter((x) => x.tid !== tid)), 6000)
    }, [])

    const generalId = useCallback(
        () => channelsRef.current.find((c) => c.isDefault)?._id || channelsRef.current.find((c) => c.joined)?._id || null, [])

    // ---------- 1) load the workspace ----------
    useEffect(() => {
        let cancelled = false
        setWorkspace(null); setError(""); setMessages([]); setActive(null)
        ws.getWorkspace(id)
            .then((res) => {
                if (cancelled) return
                const w = res.data.data
                setWorkspace(w); setChannels(w.channels); setMembers(w.members); setDms(w.dms); setUnread(w.unread || {})
                channelsRef.current = w.channels
                const first = w.channels.find((c) => c.isDefault && c.joined) || w.channels.find((c) => c.joined)
                if (first) setActive({ kind: "channel", id: first._id })
            })
            .catch((e) => !cancelled && setError(getErrorMessage(e)))
        return () => { cancelled = true }
    }, [id])

    const totalUnread = useMemo(() => Object.values(unread).reduce((a, b) => a + b, 0), [unread])
    useEffect(() => {
        document.title = `${totalUnread ? `(${totalUnread}) ` : ""}${workspace ? workspace.name + " - " : ""}Let's Discuss`
        return () => { document.title = "Let's Discuss" }
    }, [totalUnread, workspace])

    // ---------- 2) socket: connection + workspace-wide live updates ----------
    useEffect(() => {
        if (!user) return
        const onConnect = () => { setConnected(true); socket.emit("workspace:join", { workspaceId: id }) }
        const onDisconnect = () => setConnected(false)

        const onChannelCreated = (c) => {
            if (c.workspace !== id) return
            if (roleRef.current === "guest") return
            setChannels((prev) => upsertById(prev, { ...c, joined: c.createdBy === user.id }))
        }
        const onChannelDeleted = ({ workspaceId, channelId }) => {
            if (workspaceId !== id) return
            setChannels((prev) => prev.filter((c) => c._id !== channelId))
            if (activeRef.current?.id === channelId) {
                const g = channelsRef.current.find((c) => c.isDefault)?._id
                setActive(g ? { kind: "channel", id: g } : null)
                pushToast({ title: "Channel deleted", text: "An admin deleted the channel you were viewing." })
            }
        }
        const onChannelUpdated = ({ _id, github }) =>
            setChannels((prev) => prev.map((c) => (c._id === _id ? { ...c, github: github || undefined } : c)))
        const onMemberJoined = ({ workspaceId, user: u }) => workspaceId === id && setMembers((prev) => upsertById(prev, u))
        const onMemberLeft = ({ workspaceId, userId }) => workspaceId === id && setMembers((prev) => prev.filter((m) => m._id !== userId))
        const onMemberRole = ({ workspaceId, userId, role }) => {
            if (workspaceId !== id) return
            setMembers((prev) => prev.map((m) => (m._id === userId ? { ...m, role } : m)))
            if (userId === user.id) ws.getWorkspace(id).then((r) => { // my own role changed: reload what I can see
                setWorkspace(r.data.data); setChannels(r.data.data.channels)
            }).catch(() => {})
        }
        const onDmCreated = (dm) => dm.workspace === id && setDms((prev) => upsertById(prev, dm))
        const onWorkspaceGone = ({ workspaceId }) => {
            if (workspaceId !== id) return
            alert("This workspace is no longer available to you.")
            navigate("/workspaces", { replace: true })
        }
        const onNotify = ({ kind, id: cid, workspaceId, message }) => {
            if (workspaceId !== id) return
            const a = activeRef.current
            if (a && a.kind === kind && a.id === cid && !document.hidden) return // I'm looking at it
            setUnread((u) => ({ ...u, [cid]: (u[cid] || 0) + 1 }))
            const label = kind === "channel"
                ? "#" + (channelsRef.current.find((c) => c._id === cid)?.name || "channel")
                : dmLabel(dmsRef.current.find((d) => d._id === cid) || { participants: [] }, user.id)
            const who = message.sender?.name || "GitHub"
            const text = message.type === "file" ? `${who} sent a file: ${message.attachment?.name}` : `${who}: ${message.text}`
            if (!(a && a.kind === kind && a.id === cid)) pushToast({ title: label, text: text.slice(0, 120), kind, cid })
            if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification(label, { body: text.slice(0, 120) })
            }
        }
        const onCallStarted = ({ kind, id: cid, workspaceId, by }) => {
            if (workspaceId !== id) return
            setActiveCalls((c) => ({ ...c, [`${kind}:${cid}`]: { by } }))
            if (by && by !== user.name) pushToast({ title: `${by} started a call`, text: "Click to join", kind, cid, call: true })
        }
        const onCallEnded = ({ kind, id: cid }) => {
            setActiveCalls((c) => { const n = { ...c }; delete n[`${kind}:${cid}`]; return n })
            // the "X started a call - click to join" popup is no longer valid
            setToasts((t) => t.filter((x) => !(x.call && x.kind === kind && x.cid === cid)))
        }

        socket.on("connect", onConnect)
        socket.on("disconnect", onDisconnect)
        socket.on("channel:created", onChannelCreated)
        socket.on("channel:deleted", onChannelDeleted)
        socket.on("channel:updated", onChannelUpdated)
        socket.on("member:joined", onMemberJoined)
        socket.on("member:left", onMemberLeft)
        socket.on("member:role", onMemberRole)
        socket.on("dm:created", onDmCreated)
        socket.on("workspace:deleted", onWorkspaceGone)
        socket.on("workspace:removed", onWorkspaceGone)
        socket.on("notify:message", onNotify)
        socket.on("call:started", onCallStarted)
        socket.on("call:ended", onCallEnded)
        socket.connect()
        if (socket.connected) onConnect()

        return () => {
            socket.off("connect", onConnect); socket.off("disconnect", onDisconnect)
            socket.off("channel:created", onChannelCreated); socket.off("channel:deleted", onChannelDeleted)
            socket.off("channel:updated", onChannelUpdated)
            socket.off("member:joined", onMemberJoined); socket.off("member:left", onMemberLeft); socket.off("member:role", onMemberRole)
            socket.off("dm:created", onDmCreated)
            socket.off("workspace:deleted", onWorkspaceGone); socket.off("workspace:removed", onWorkspaceGone)
            socket.off("notify:message", onNotify)
            socket.off("call:started", onCallStarted); socket.off("call:ended", onCallEnded)
            socket.disconnect()
        }
    }, [id, user, navigate, pushToast])

    // ---------- 3) active conversation: history + live messages + typing ----------
    useEffect(() => {
        if (!active) return
        const { kind, id: cid } = active
        let cancelled = false
        setMessages([]); setTyping({}); setSendError("")
        setUnread((u) => { const n = { ...u }; delete n[cid]; return n })

        const join = () => socket.emit("conversation:join", { kind, id: cid })
        const onNew = (m) => {
            if (String(m.channel || m.dm) !== cid) return
            setMessages((prev) => upsertById(prev, m))
            if (String(m.sender?._id) !== String(user.id)) chat.markRead(kind, cid).catch(() => {})
        }
        const onUpdated = (m) => setMessages((prev) => prev.map((x) => (x._id === m._id ? m : x)))
        const onDeleted = ({ _id }) =>
            setMessages((prev) => prev.map((x) => (x._id === _id ? { ...x, deleted: true, text: "", attachment: undefined } : x)))
        const onTyping = ({ kind: k, id: i, userId, name, isTyping }) => {
            if (k !== kind || i !== cid) return
            clearTimeout(typingTimers.current[userId])
            if (!isTyping) return setTyping((t) => { const n = { ...t }; delete n[userId]; return n })
            setTyping((t) => ({ ...t, [userId]: name }))
            typingTimers.current[userId] = setTimeout(
                () => setTyping((t) => { const n = { ...t }; delete n[userId]; return n }), 4000)
        }

        socket.on("connect", join)
        socket.on("message:new", onNew)
        socket.on("message:updated", onUpdated)
        socket.on("message:deleted", onDeleted)
        socket.on("typing", onTyping)
        join()

        chat.getMessages(kind, cid)
            .then((res) => {
                if (cancelled) return
                setMessages((prev) => {
                    const ids = new Set(res.data.data.map((m) => m._id))
                    return [...res.data.data, ...prev.filter((m) => !ids.has(m._id))]
                })
            })
            .catch((e) => !cancelled && setSendError(getErrorMessage(e)))
        chat.markRead(kind, cid).catch(() => {})
        socket.emit("call:status", { kind, id: cid }, (r) => {
            if (cancelled || !r) return
            setActiveCalls((c) => {
                const n = { ...c }
                if (r.active) n[`${kind}:${cid}`] = n[`${kind}:${cid}`] || { by: "Someone" }
                else delete n[`${kind}:${cid}`]
                return n
            })
        })

        return () => {
            cancelled = true
            Object.values(typingTimers.current).forEach(clearTimeout)
            socket.off("connect", join); socket.off("message:new", onNew); socket.off("message:updated", onUpdated)
            socket.off("message:deleted", onDeleted); socket.off("typing", onTyping)
            socket.emit("conversation:leave", { kind, id: cid })
        }
    }, [active, user.id])

    // ---------- helpers ----------
    const select = (kind, cid) => { setActive({ kind, id: cid }); setSidebarOpen(false) }
    const activeChannel = active?.kind === "channel" ? channels.find((c) => c._id === active.id) : null
    const activeDm = active?.kind === "dm" ? dms.find((d) => d._id === active.id) : null
    const myRole = workspace?.myRole || "member"
    const isAdmin = myRole === "admin"
    const title = activeChannel ? `#${activeChannel.name}` : activeDm ? dmLabel(activeDm, user.id) : ""
    const callKey = active ? `${active.kind}:${active.id}` : null

    const sendText = (text) => {
        if (!active) return
        setSendError("")
        socket.emit("message:send", { kind: active.kind, id: active.id, text }, (res) => {
            if (!res?.success) setSendError(res?.message || "Could not send message")
        })
    }
    const sendFile = async (file, text, onProgress) => {
        try { setSendError(""); await chat.uploadFile(active.kind, active.id, file, text, onProgress); return true }
        catch (e) { setSendError(getErrorMessage(e)); return false }
    }
    const editMsg = async (m, text) => {
        try { const r = await chat.editMessage(m._id, text); setMessages((p) => p.map((x) => (x._id === m._id ? r.data.data : x))) }
        catch (e) { setSendError(getErrorMessage(e)) }
    }
    const deleteMsg = async (m) => {
        if (!confirm("Delete this message? This can't be undone.")) return
        try { await chat.deleteMessage(m._id) } catch (e) { setSendError(getErrorMessage(e)) }
    }

    const createChannel = async (name, description) => {
        const r = await ws.createChannel(id, name, description)
        setChannels((prev) => { const rest = prev.filter((c) => c._id !== r.data.data._id); return [...rest, r.data.data] })
        select("channel", r.data.data._id)
    }
    const joinChannel = async (c) => {
        const r = await chat.joinChannel(c._id)
        setChannels((prev) => prev.map((x) => (x._id === c._id ? r.data.data : x)))
        select("channel", c._id)
        setModal(null)
    }
    const leaveChannel = async () => {
        if (!confirm(`Leave #${activeChannel.name}?`)) return
        try {
            await chat.leaveChannel(activeChannel._id)
            setChannels((prev) => prev.map((x) => (x._id === activeChannel._id ? { ...x, joined: false } : x)))
            const g = generalId(); setActive(g ? { kind: "channel", id: g } : null)
        } catch (e) { setSendError(getErrorMessage(e)) }
    }
    const deleteChannel = async () => {
        if (!confirm(`Delete #${activeChannel.name} and all its messages for everyone?`)) return
        try { await chat.deleteChannel(activeChannel._id) } catch (e) { setSendError(getErrorMessage(e)) }
    }
    const startDm = async (userIds) => {
        const r = await chat.createOrGetDm(id, userIds)
        setDms((prev) => upsertById(prev, r.data.data))
        select("dm", r.data.data._id)
    }
    const inviteEmails = async (emails) => {
        const r = await ws.inviteMembers(id, emails)
        const failed = r.data.failedEmails || []
        return failed.length ? `${r.data.message}. Failed: ${failed.join(", ")}` : r.data.message
    }
    const setRole = async (m, role) => {
        try { await ws.setMemberRole(id, m._id, role); setMembers((p) => p.map((x) => (x._id === m._id ? { ...x, role } : x))) }
        catch (e) { alert(getErrorMessage(e)) }
    }
    const removeMember = async (m) => {
        if (!confirm(`Remove ${m.name} from ${workspace.name}?`)) return
        try { await ws.removeMember(id, m._id); setMembers((p) => p.filter((x) => x._id !== m._id)) } catch (e) { alert(getErrorMessage(e)) }
    }
    const leaveWs = async () => {
        if (!confirm(`Leave "${workspace.name}"?`)) return
        const r = await dispatch(leaveWorkspace(id)); if (leaveWorkspace.fulfilled.match(r)) navigate("/workspaces")
    }
    const deleteWs = async () => {
        if (!confirm(`Delete "${workspace.name}" for everyone? All channels, messages and files will be removed permanently.`)) return
        const r = await dispatch(deleteWorkspace(id)); if (deleteWorkspace.fulfilled.match(r)) navigate("/workspaces")
    }
    const logout = async () => { await dispatch(logoutUser()); navigate("/login") }
    const enableNotifications = async () => { if (typeof Notification !== "undefined") setNotifPerm(await Notification.requestPermission()) }
    const reloadChannelInfo = () => ws.getWorkspace(id).then((r) => setChannels(r.data.data.channels)).catch(() => {})

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3">
                <p className="text-red-600">{error}</p>
                <Link to="/workspaces" className="text-[#00694c] font-medium">← Back to my workspaces</Link>
            </div>
        )
    }
    if (!workspace) return <div className="p-10 text-center text-slate-500">Loading workspace...</div>

    const inviteUrl = workspace.inviteLink ? `${window.location.origin}/join/${workspace.inviteLink}` : ""
    const inCallHere = call.call && call.call.key === callKey
    const showPanel = panel === "github" && !activeChannel ? "members" : panel
    const typingNames = Object.values(typing)

    return (
        <div className="h-screen w-full flex bg-white text-slate-800 overflow-hidden">
            <Sidebar
                workspace={workspace} channels={channels} dms={dms} unread={unread} active={active} activeCalls={activeCalls}
                user={user} connected={connected} open={sidebarOpen} notifPerm={notifPerm}
                onSelect={select} onBrowse={() => setModal("browse")} onNewChannel={() => setModal("channel")}
                onNewDm={() => setModal("dm")} onSearch={() => setModal("search")} onInvite={() => setModal("invite")}
                onClose={() => setSidebarOpen(false)} onLogout={logout} onEnableNotifications={enableNotifications}
            />

            <main className="flex-1 flex flex-col min-w-0">
                <header className="border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
                    <button className="md:hidden text-slate-600 cursor-pointer" onClick={() => setSidebarOpen(true)}><FaBars /></button>
                    <div className="min-w-0 flex-1">
                        <p className="font-bold flex items-center gap-1 truncate">
                            {activeChannel && <FaHashtag className="text-slate-400 shrink-0" />}
                            <span className="truncate">{activeChannel ? activeChannel.name : title || "Pick a conversation"}</span>
                            {activeChannel?.github?.repo && <FaGithub className="text-slate-500 shrink-0" title={activeChannel.github.repo} />}
                        </p>
                        {activeChannel?.description && <p className="text-xs text-slate-500 truncate">{activeChannel.description}</p>}
                        {activeDm?.isGroup && <p className="text-xs text-slate-500">Group chat · {activeDm.participants.length} people</p>}
                    </div>

                    {active && callKey && activeCalls[callKey] && !inCallHere && (
                        <button onClick={() => call.join(active.kind, active.id)}
                            className="bg-green-600 text-white text-sm rounded-full px-3 py-1 animate-pulse cursor-pointer">Join call</button>
                    )}
                    {active && !activeCalls[callKey] && !call.call && (
                        <button onClick={() => call.join(active.kind, active.id)} title="Start a video call"
                            className="border border-gray-300 rounded px-2.5 py-1.5 text-slate-600 hover:bg-gray-50 cursor-pointer"><FaVideo /></button>
                    )}
                    {activeChannel && (
                        <button onClick={() => setPanel(showPanel === "github" ? null : "github")} title="GitHub"
                            className={`border rounded px-2.5 py-1.5 cursor-pointer ${showPanel === "github" ? "bg-slate-900 text-white" : "border-gray-300 text-slate-600 hover:bg-gray-50"}`}><FaGithub /></button>
                    )}
                    <button onClick={() => setPanel(showPanel === "members" ? null : "members")} title="People"
                        className={`border rounded px-2.5 py-1.5 cursor-pointer ${showPanel === "members" ? "bg-slate-900 text-white" : "border-gray-300 text-slate-600 hover:bg-gray-50"}`}><FaUsers /></button>
                    <button onClick={() => setModal("search")} title="Search" className="border border-gray-300 rounded px-2.5 py-1.5 text-slate-600 hover:bg-gray-50 cursor-pointer"><FaSearch /></button>
                    {activeChannel && !activeChannel.isDefault && (
                        <span className="hidden lg:flex gap-3 text-xs">
                            <button onClick={leaveChannel} className="text-slate-500 hover:underline cursor-pointer">Leave</button>
                            {isAdmin && <button onClick={deleteChannel} className="text-red-600 hover:underline cursor-pointer">Delete</button>}
                        </span>
                    )}
                </header>

                {call.error && (
                    <div className="bg-red-50 text-red-700 text-sm px-4 py-2 flex justify-between">
                        {call.error}<button onClick={call.clearError} className="cursor-pointer">×</button>
                    </div>
                )}

                {active ? (
                    <>
                        <MessageList messages={messages} me={user} isAdmin={isAdmin} onEdit={editMsg} onDelete={deleteMsg}
                            showNames={!(activeDm && !activeDm.isGroup)}
                            emptyText={activeChannel ? `This is the start of #${activeChannel.name}. Say hello!` : "This is the start of your conversation. Say hello!"} />
                        <MessageInput
                            key={active.id}
                            placeholder={`Message ${title}`} disabled={!connected}
                            canUpload={myRole !== "guest"} error={sendError} typingNames={typingNames}
                            onSend={sendText} onUpload={sendFile}
                            onTyping={(isTyping) => socket.emit("typing", { kind: active.kind, id: active.id, isTyping })}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">Pick a channel or start a direct message.</div>
                )}
            </main>

            {showPanel && (
                <aside className="fixed lg:static inset-y-0 right-0 z-30 w-80 max-w-full bg-white border-l border-gray-200 overflow-y-auto shadow-xl lg:shadow-none">
                    <div className="lg:hidden text-right p-2"><button onClick={() => setPanel(null)} className="text-slate-500 cursor-pointer">Close ×</button></div>
                    {showPanel === "members" && (
                        <MembersPanel members={members} me={user} myRole={myRole}
                            onDm={(m) => startDm([m._id])} onInvite={() => setModal("invite")}
                            onSetRole={setRole} onRemove={removeMember} onLeave={leaveWs} onDeleteWorkspace={deleteWs} />
                    )}
                    {showPanel === "github" && activeChannel && (
                        <GithubPanel channel={activeChannel} canManage={myRole !== "guest"} onShare={sendText} onChanged={reloadChannelInfo} />
                    )}
                </aside>
            )}

            <CallOverlay api={call} title={call.call ? (call.call.kind === "channel" ? "#" + (channels.find((c) => c._id === call.call.id)?.name || "") : dmLabel(dms.find((d) => d._id === call.call.id) || { participants: [] }, user.id)) : ""} myName={user.name} />

            {/* toasts */}
            <div className="fixed bottom-4 right-4 z-[70] space-y-2 w-72">
                {toasts.map((t) => (
                    <button key={t.tid} onClick={() => { if (t.kind) select(t.kind, t.cid); if (t.call) call.join(t.kind, t.cid); setToasts((x) => x.filter((y) => y.tid !== t.tid)) }}
                        className="block w-full text-left bg-slate-900 text-white rounded-lg shadow-lg px-3 py-2 cursor-pointer">
                        <p className="text-sm font-semibold truncate">{t.title}</p>
                        <p className="text-xs text-slate-300 truncate">{t.text}</p>
                    </button>
                ))}
            </div>

            {modal === "channel" && <NewChannelModal onClose={() => setModal(null)} onCreate={createChannel} />}
            {modal === "browse" && <BrowseChannelsModal channels={channels} onClose={() => setModal(null)} onJoin={joinChannel} onOpen={(c) => select("channel", c._id)} />}
            {modal === "dm" && <NewDmModal members={members} me={user} canGroup={myRole !== "guest"} onClose={() => setModal(null)} onStart={startDm} />}
            {modal === "invite" && <InviteModal workspace={workspace} inviteUrl={inviteUrl} onClose={() => setModal(null)} onInviteEmails={inviteEmails} />}
            {modal === "search" && (
                <SearchModal workspace={{ ...workspace, members }} channels={channels} dms={dms} user={user} onClose={() => setModal(null)}
                    onOpenConversation={select} onOpenUser={(u) => u._id !== user.id && startDm([u._id])} />
            )}
        </div>
    )
}
