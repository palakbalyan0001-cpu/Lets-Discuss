import { useEffect, useState } from "react"
import { FaFileAlt, FaHashtag } from "react-icons/fa"
import Avatar from "./Avatar"
import { searchWorkspace } from "../../api/chat"
import { getErrorMessage } from "../../api/axios"
import { formatTime, renderText } from "../../utils/linkify"
import { dmLabel } from "../../utils/chat"

export function Modal({ title, onClose, children, wide }) {
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose()
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])
    return (
        <div onClick={onClose} className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-4 overflow-y-auto">
            <div onClick={(e) => e.stopPropagation()} className={`bg-white rounded-2xl p-6 w-full ${wide ? "max-w-2xl" : "max-w-md"} shadow-2xl space-y-4 text-slate-800`}>
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer text-xl leading-none">×</button>
                </div>
                {children}
            </div>
        </div>
    )
}

const primary = "bg-[#00694c] text-white rounded px-4 py-1.5 cursor-pointer disabled:opacity-50"

export function NewChannelModal({ onClose, onCreate }) {
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [error, setError] = useState("")
    const submit = async (e) => {
        e.preventDefault()
        try { await onCreate(name, description); onClose() } catch (err) { setError(getErrorMessage(err)) }
    }
    return (
        <Modal title="Create a channel" onClose={onClose}>
            <form onSubmit={submit} className="space-y-3">
                <p className="text-sm text-slate-500">Channels are where your team talks about a topic, like #design or #team.</p>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. frontend-team" className="w-full border border-gray-300 rounded p-2" />
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" maxLength={200} className="w-full border border-gray-300 rounded p-2" />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <div className="flex justify-end"><button className={primary}>Create channel</button></div>
            </form>
        </Modal>
    )
}

export function BrowseChannelsModal({ channels, onClose, onJoin, onOpen }) {
    const [error, setError] = useState("")
    const join = async (c) => {
        try { await onJoin(c) } catch (e) { setError(getErrorMessage(e)) }
    }
    return (
        <Modal title="Browse channels" onClose={onClose}>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <ul className="divide-y max-h-80 overflow-y-auto">
                {channels.map((c) => (
                    <li key={c._id} className="py-2 flex items-center gap-3">
                        <FaHashtag className="text-slate-400" />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{c.name}</p>
                            <p className="text-xs text-slate-500 truncate">{c.description || (c.isDefault ? "Everyone is here" : `${c.memberCount} member${c.memberCount === 1 ? "" : "s"}`)}</p>
                        </div>
                        {c.joined
                            ? <button onClick={() => { onOpen(c); onClose() }} className="text-sm text-[#00694c] cursor-pointer">Open</button>
                            : <button onClick={() => join(c)} className="text-sm bg-[#00694c] text-white rounded px-3 py-1 cursor-pointer">Join</button>}
                    </li>
                ))}
            </ul>
        </Modal>
    )
}

export function NewDmModal({ members, me, canGroup, onClose, onStart }) {
    const [picked, setPicked] = useState([])
    const [q, setQ] = useState("")
    const [error, setError] = useState("")
    const list = members.filter((m) => m._id !== me.id && (m.name + m.email).toLowerCase().includes(q.toLowerCase()))
    const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
    const go = async () => {
        try { await onStart(picked); onClose() } catch (e) { setError(getErrorMessage(e)) }
    }
    return (
        <Modal title="New message" onClose={onClose}>
            <p className="text-sm text-slate-500">{canGroup ? "Pick one person for a private chat, or several for a group chat." : "Pick a person to chat with."}</p>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="w-full border border-gray-300 rounded p-2" />
            <ul className="max-h-64 overflow-y-auto divide-y">
                {list.map((m) => (
                    <li key={m._id}>
                        <label className="flex items-center gap-3 py-2 cursor-pointer">
                            <input type={canGroup ? "checkbox" : "radio"} checked={picked.includes(m._id)}
                                onChange={() => (canGroup ? toggle(m._id) : setPicked([m._id]))} />
                            <Avatar name={m.name} size="h-8 w-8" />
                            <span className="min-w-0"><span className="block font-medium truncate">{m.name}</span><span className="block text-xs text-slate-500 truncate">{m.title || m.email}</span></span>
                        </label>
                    </li>
                ))}
                {list.length === 0 && <li className="py-3 text-sm text-slate-400">No one found</li>}
            </ul>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex justify-end">
                <button disabled={!picked.length} onClick={go} className={primary}>{picked.length > 1 ? "Start group chat" : "Start chat"}</button>
            </div>
        </Modal>
    )
}

export function InviteModal({ workspace, inviteUrl, onClose, onInviteEmails }) {
    const [emails, setEmails] = useState("")
    const [msg, setMsg] = useState("")
    const [copied, setCopied] = useState(false)
    const copy = async () => {
        try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch (e) { console.log(e) }
    }
    const submit = async (e) => {
        e.preventDefault()
        try { setMsg(await onInviteEmails(emails.split(",").map((x) => x.trim()).filter(Boolean))); setEmails("") }
        catch (err) { setMsg(getErrorMessage(err)) }
    }
    return (
        <Modal title={`Invite people to ${workspace.name}`} onClose={onClose}>
            <div>
                <p className="text-sm text-slate-500 mb-1">Share this invite link</p>
                <div className="flex gap-2">
                    <input readOnly value={inviteUrl} className="flex-1 border border-gray-300 rounded p-2 text-sm" />
                    <button onClick={copy} className={primary}>{copied ? "Copied!" : "Copy"}</button>
                </div>
            </div>
            <form onSubmit={submit} className="space-y-2">
                <p className="text-sm text-slate-500">Or send email invites (comma separated)</p>
                <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="alex@co.com, sam@co.com" className="w-full border border-gray-300 rounded p-2" />
                {msg && <p className="text-sm text-slate-600">{msg}</p>}
                <div className="flex justify-end"><button className={primary}>Send invites</button></div>
            </form>
        </Modal>
    )
}

export function SearchModal({ workspace, channels, dms, user, onClose, onOpenConversation, onOpenUser }) {
    const [q, setQ] = useState("")
    const [scope, setScope] = useState("all")
    const [where, setWhere] = useState("")
    const [from, setFrom] = useState("")
    const [has, setHas] = useState("")
    const [after, setAfter] = useState("")
    const [before, setBefore] = useState("")
    const [res, setRes] = useState(null)
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const filtersUsed = where || from || has || after || before
    useEffect(() => {
        if (!q.trim() && !filtersUsed) { setRes(null); setError(""); return }
        const t = setTimeout(async () => {
            setLoading(true)
            try {
                const params = { workspaceId: workspace._id, q: q.trim(), scope }
                if (where.startsWith("channel:")) params.channelId = where.slice(8)
                if (where.startsWith("dm:")) params.dmId = where.slice(3)
                if (from) params.from = from
                if (has) params.has = has
                if (after) params.after = after
                if (before) params.before = before
                const r = await searchWorkspace(params)
                setRes(r.data); setError("")
            } catch (e) { setError(getErrorMessage(e)) }
            setLoading(false)
        }, 300)
        return () => clearTimeout(t)
    }, [q, scope, where, from, has, after, before, workspace._id, filtersUsed])

    const whereOf = (m) => {
        if (m.channel) { const c = channels.find((x) => x._id === m.channel); return c ? `#${c.name}` : "channel" }
        const d = dms.find((x) => x._id === m.dm); return d ? dmLabel(d, user.id) : "direct message"
    }
    const sel = "border border-gray-300 rounded px-2 py-1 text-sm"

    return (
        <Modal title="Search" onClose={onClose} wide>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages, files and people..." className="w-full border border-gray-300 rounded-lg p-2.5" />
            <div className="flex flex-wrap gap-2">
                <select className={sel} value={scope} onChange={(e) => setScope(e.target.value)}>
                    <option value="all">Everything</option><option value="messages">Messages</option><option value="people">People</option>
                </select>
                <select className={sel} value={where} onChange={(e) => setWhere(e.target.value)}>
                    <option value="">Anywhere</option>
                    {channels.filter((c) => c.joined).map((c) => <option key={c._id} value={`channel:${c._id}`}>#{c.name}</option>)}
                    {dms.map((d) => <option key={d._id} value={`dm:${d._id}`}>DM: {dmLabel(d, user.id)}</option>)}
                </select>
                <select className={sel} value={from} onChange={(e) => setFrom(e.target.value)}>
                    <option value="">From anyone</option>
                    {workspace.members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
                <select className={sel} value={has} onChange={(e) => setHas(e.target.value)}>
                    <option value="">Any type</option><option value="file">Has file</option><option value="link">Has link</option>
                </select>
                <input type="date" className={sel} value={after} onChange={(e) => setAfter(e.target.value)} title="After" />
                <input type="date" className={sel} value={before} onChange={(e) => setBefore(e.target.value)} title="Before" />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            {loading && <p className="text-sm text-slate-400">Searching...</p>}
            {res && (
                <div className="max-h-96 overflow-y-auto space-y-4">
                    {res.users.length > 0 && (
                        <div>
                            <p className="text-xs uppercase font-bold text-slate-400 mb-1">People</p>
                            {res.users.map((u) => (
                                <button key={u._id} onClick={() => { onOpenUser(u); onClose() }} className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 text-left cursor-pointer">
                                    <Avatar name={u.name} size="h-8 w-8" />
                                    <span><span className="block font-medium">{u.name}</span><span className="block text-xs text-slate-500">{u.title || u.email}</span></span>
                                </button>
                            ))}
                        </div>
                    )}
                    {res.messages.length > 0 && (
                        <div>
                            <p className="text-xs uppercase font-bold text-slate-400 mb-1">Messages</p>
                            {res.messages.map((m) => (
                                <button key={m._id} onClick={() => { onOpenConversation(m.channel ? "channel" : "dm", m.channel || m.dm); onClose() }}
                                    className="w-full text-left p-2 rounded hover:bg-gray-100 cursor-pointer">
                                    <p className="text-xs text-slate-500">
                                        <span className="font-semibold text-slate-700">{m.sender?.name || "GitHub"}</span> in {whereOf(m)} · {new Date(m.createdAt).toLocaleDateString()} {formatTime(m.createdAt)}
                                    </p>
                                    <p className="text-sm break-words">
                                        {m.attachment && <FaFileAlt className="inline mr-1 text-slate-400" />}
                                        {m.text ? renderText(m.text) : m.attachment?.name}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                    {!res.users.length && !res.messages.length && <p className="text-sm text-slate-400">No results.</p>}
                </div>
            )}
        </Modal>
    )
}
