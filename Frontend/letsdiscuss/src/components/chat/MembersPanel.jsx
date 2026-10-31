import { useState } from "react"
import { FaUserPlus } from "react-icons/fa"
import Avatar from "./Avatar"

const ROLE_STYLE = { admin: "bg-amber-100 text-amber-800", member: "bg-slate-100 text-slate-600", guest: "bg-violet-100 text-violet-700" }

export default function MembersPanel({ members, me, myRole, onDm, onInvite, onSetRole, onRemove, onLeave, onDeleteWorkspace }) {
    const [q, setQ] = useState("")
    const list = members.filter((m) => (m.name + m.email).toLowerCase().includes(q.toLowerCase()))
    return (
        <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-bold">People ({members.length})</h3>
                {myRole !== "guest" && <button onClick={onInvite} className="text-[#00694c] text-sm flex items-center gap-1 cursor-pointer"><FaUserPlus /> Invite</button>}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find people" className="w-full border border-gray-300 rounded p-1.5 text-sm" />
            <ul className="space-y-2">
                {list.map((m) => (
                    <li key={m._id} className="flex items-center gap-2">
                        <Avatar name={m.name} size="h-8 w-8" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{m.name}{m._id === me.id ? " (you)" : ""}</p>
                            <p className="text-xs text-slate-500 truncate">{m.title || m.email}</p>
                        </div>
                        <span className={`text-[10px] rounded px-1.5 py-0.5 ${ROLE_STYLE[m.role]}`}>{m.role}</span>
                        {m._id !== me.id && (
                            <button onClick={() => onDm(m)} className="text-xs text-[#00694c] cursor-pointer">Message</button>
                        )}
                        {myRole === "admin" && m.role !== "admin" && (
                            <>
                                <button onClick={() => onSetRole(m, m.role === "guest" ? "member" : "guest")} className="text-xs text-slate-500 hover:underline cursor-pointer">
                                    {m.role === "guest" ? "Make member" : "Make guest"}
                                </button>
                                <button onClick={() => onRemove(m)} className="text-xs text-red-600 hover:underline cursor-pointer">Remove</button>
                            </>
                        )}
                    </li>
                ))}
            </ul>
            <div className="pt-3 border-t text-sm">
                {myRole === "admin"
                    ? <button onClick={onDeleteWorkspace} className="text-red-600 hover:underline cursor-pointer">Delete this workspace</button>
                    : <button onClick={onLeave} className="text-red-600 hover:underline cursor-pointer">Leave this workspace</button>}
            </div>
        </div>
    )
}
