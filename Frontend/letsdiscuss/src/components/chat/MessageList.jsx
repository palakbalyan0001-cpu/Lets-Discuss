import { useEffect, useRef, useState } from "react"
import { FaDownload, FaEdit, FaFileAlt, FaGithub, FaTrash } from "react-icons/fa"
import { fileUrl } from "../../api/chat"
import { formatDay, formatSize, formatTime, renderText } from "../../utils/linkify"

// a stable colour per sender name (shown above other people's messages in channels / groups)
const NAME_COLORS = ["text-emerald-700", "text-sky-700", "text-rose-600", "text-violet-700", "text-amber-700", "text-teal-700"]
const nameColor = (name = "") => NAME_COLORS[(name.charCodeAt(0) + name.length) % NAME_COLORS.length]

function Attachment({ m }) {
    const a = m.attachment
    if (!a) return null
    if (a.mimetype?.startsWith("image/")) {
        return (
            <a href={fileUrl(m._id)} target="_blank" rel="noopener noreferrer">
                <img src={fileUrl(m._id)} alt={a.name} className="my-1 max-h-64 max-w-full rounded-md" />
            </a>
        )
    }
    return (
        <a href={fileUrl(m._id, true)} className="my-1 flex items-center gap-3 bg-black/5 rounded-md px-3 py-2 hover:bg-black/10">
            <FaFileAlt className="text-slate-500 text-xl shrink-0" />
            <span className="min-w-0">
                <span className="block text-sm font-medium truncate max-w-[14rem]">{a.name}</span>
                <span className="block text-xs text-slate-500">{formatSize(a.size)}</span>
            </span>
            <FaDownload className="text-slate-400 shrink-0" />
        </a>
    )
}

function Bubble({ m, mine, first, showName, isAdmin, onEdit, onDelete }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(m.text)
    const canEdit = mine && !m.deleted
    const canDelete = (mine || isAdmin) && !m.deleted

    const save = () => {
        const text = draft.trim()
        if (!text && m.type !== "file") return
        onEdit(m, text)
        setEditing(false)
    }

    // green + right for me, white + left for everyone else; the first bubble of a run gets the little "tail"
    const color = mine ? "bg-[#d9fdd3]" : "bg-white"
    const tail = first ? (mine ? "rounded-tr-none" : "rounded-tl-none") : ""

    return (
        <div className={`group relative max-w-[85%] sm:max-w-[70%] min-w-[5rem] rounded-lg ${color} ${tail} shadow-sm px-2.5 pt-1.5 pb-1`}>
            {showName && !mine && first && (
                <p className={`text-xs font-semibold ${nameColor(m.sender?.name)}`}>{m.sender?.name || "Unknown"}</p>
            )}

            {m.deleted ? (
                <p className="text-sm italic text-slate-400 pr-12">This message was deleted</p>
            ) : editing ? (
                <div className="space-y-1 min-w-[14rem]">
                    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={4000}
                        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false) }}
                        className="w-full border border-gray-300 rounded px-2 py-1 bg-white" />
                    <div className="text-xs space-x-3">
                        <button onClick={save} className="text-[#00694c] font-semibold cursor-pointer">Save</button>
                        <button onClick={() => setEditing(false)} className="cursor-pointer">Cancel</button>
                    </div>
                </div>
            ) : (
                <>
                    <Attachment m={m} />
                    {m.text && <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{renderText(m.text)}</p>}
                </>
            )}

            {!editing && (
                <p className="text-[10px] text-slate-500 text-right leading-none mt-0.5 select-none">
                    {m.edited && !m.deleted && <span>edited · </span>}{formatTime(m.createdAt)}
                </p>
            )}

            {!editing && (canEdit || canDelete) && (
                <div className={`absolute -top-3 ${mine ? "left-1" : "right-1"} hidden group-hover:flex gap-2 bg-white border border-gray-200 rounded px-2 py-1 text-slate-500 shadow-sm`}>
                    {canEdit && <button title="Edit" className="hover:text-slate-900 cursor-pointer" onClick={() => { setDraft(m.text); setEditing(true) }}><FaEdit /></button>}
                    {canDelete && <button title="Delete" className="hover:text-red-600 cursor-pointer" onClick={() => onDelete(m)}><FaTrash /></button>}
                </div>
            )}
        </div>
    )
}

function GithubCard({ m, isAdmin, onDelete }) {
    return (
        <div className="group mx-auto max-w-[85%] sm:max-w-md flex items-start gap-2 bg-white border-l-4 border-slate-700 rounded-lg shadow-sm px-3 py-2 text-sm">
            <FaGithub className="mt-0.5 text-slate-700 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="break-words">{m.text}</p>
                {m.meta?.url && (
                    <a href={m.meta.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs hover:underline">View on GitHub</a>
                )}
                <p className="text-[10px] text-slate-400">{formatTime(m.createdAt)}</p>
            </div>
            {isAdmin && (
                <button onClick={() => onDelete(m)} title="Delete" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 cursor-pointer"><FaTrash /></button>
            )}
        </div>
    )
}

// showNames: show the sender's name above incoming messages (channels and group chats; not needed in a 1:1 chat)
export default function MessageList({ messages, me, isAdmin, onEdit, onDelete, emptyText, showNames = true }) {
    const bottomRef = useRef(null)
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

    return (
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-[#efeae2]">
            {messages.length === 0 && (
                <p className="text-center text-slate-500 text-sm bg-white/70 rounded-lg px-3 py-2 w-fit mx-auto">{emptyText}</p>
            )}
            {messages.map((m, i) => {
                const prev = messages[i - 1]
                const day = formatDay(m.createdAt)
                const showDay = !prev || day !== formatDay(prev.createdAt)
                const mine = String(m.sender?._id) === String(me?.id)
                const bot = m.type === "github"
                // same person, within 5 minutes -> bubbles sit closer together and share one name label
                const first = showDay || !prev || prev.type === "github" || String(prev.sender?._id) !== String(m.sender?._id) ||
                    new Date(m.createdAt) - new Date(prev.createdAt) > 5 * 60 * 1000
                return (
                    <div key={m._id}>
                        {showDay && (
                            <div className="flex justify-center my-3">
                                <span className="text-xs text-slate-600 bg-white/80 rounded-lg px-3 py-1 shadow-sm">{formatDay(m.createdAt)}</span>
                            </div>
                        )}
                        <div className={`flex ${bot ? "justify-center" : mine ? "justify-end" : "justify-start"} ${first ? "mt-2" : "mt-0.5"}`}>
                            {bot
                                ? <GithubCard m={m} isAdmin={isAdmin} onDelete={onDelete} />
                                : <Bubble m={m} mine={mine} first={first} showName={showNames} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />}
                        </div>
                    </div>
                )
            })}
            <div ref={bottomRef} />
        </div>
    )
}
