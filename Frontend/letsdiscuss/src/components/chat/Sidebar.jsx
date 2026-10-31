import { Link } from "react-router-dom"
import { FaBell, FaHashtag, FaPlus, FaSearch, FaVideo, FaUserPlus } from "react-icons/fa"
import { dmLabel } from "../../utils/chat"

function Badge({ n }) {
    return n ? <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 min-w-4 text-center">{n > 98 ? "99+" : n}</span> : null
}

export default function Sidebar({
    workspace, channels, dms, unread, active, activeCalls, user, connected, open, notifPerm,
    onSelect, onBrowse, onNewChannel, onNewDm, onSearch, onInvite, onClose, onLogout, onEnableNotifications,
}) {
    const joined = channels.filter((c) => c.joined)
    const isActive = (kind, id) => active?.kind === kind && active?.id === id
    const item = (kind, id, label, icon) => {
        const on = isActive(kind, id)
        const n = unread[id] || 0
        return (
            <li key={id}>
                <button onClick={() => onSelect(kind, id)}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${on ? "bg-teal-700 font-semibold" : "hover:bg-teal-800"} ${n && !on ? "font-bold text-white" : ""}`}>
                    {icon}
                    <span className="truncate">{label}</span>
                    {activeCalls[`${kind}:${id}`] && <FaVideo className="text-green-300 text-xs shrink-0" title="Call in progress" />}
                    {!on && <Badge n={n} />}
                </button>
            </li>
        )
    }

    return (
        <>
            {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onClose} />}
            <aside className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-teal-900 text-teal-50 flex flex-col shrink-0 transform transition-transform md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="p-4 border-b border-teal-700">
                    <Link to="/workspaces" className="text-xs text-teal-200 hover:underline">← All workspaces</Link>
                    <h2 className="font-bold text-lg truncate">{workspace.name}</h2>
                    <div className="flex items-center justify-between text-xs text-teal-200">
                        <span className="flex items-center gap-1">
                            <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`}></span>
                            {connected ? "Live" : "Connecting..."} · {workspace.myRole}
                        </span>
                        {notifPerm !== "granted" && notifPerm !== "denied" && notifPerm !== "unsupported" && (
                            <button title="Enable desktop notifications" onClick={onEnableNotifications} className="hover:text-white cursor-pointer"><FaBell /></button>
                        )}
                    </div>
                </div>

                <div className="px-3 pt-3">
                    <button onClick={onSearch} className="w-full flex items-center gap-2 bg-teal-800 hover:bg-teal-700 rounded px-2 py-1.5 text-sm text-teal-200 cursor-pointer">
                        <FaSearch className="text-xs" /> Search messages & people
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-5">
                    <div>
                        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-teal-300 mb-1">
                            <span>Channels</span>
                            <span className="flex gap-3">
                                {workspace.myRole !== "guest" && <button className="cursor-pointer hover:text-white normal-case" title="Browse all channels" onClick={onBrowse}>Browse</button>}
                                {workspace.myRole !== "guest" && <button className="cursor-pointer hover:text-white" title="New channel" onClick={onNewChannel}><FaPlus /></button>}
                            </span>
                        </div>
                        <ul>{joined.map((c) => item("channel", c._id, c.name, <FaHashtag className="text-xs shrink-0" />))}</ul>
                    </div>

                    <div>
                        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-teal-300 mb-1">
                            <span>Direct messages</span>
                            <button className="cursor-pointer hover:text-white" title="New message" onClick={onNewDm}><FaPlus /></button>
                        </div>
                        <ul>
                            {dms.map((d) => item("dm", d._id, dmLabel(d, user.id), <span className="h-2 w-2 rounded-full bg-teal-300 shrink-0" />))}
                            {dms.length === 0 && <li className="text-xs text-teal-300 px-2">No conversations yet</li>}
                        </ul>
                    </div>

                    {workspace.myRole !== "guest" && (
                        <button onClick={onInvite} className="flex items-center gap-2 text-sm text-teal-200 hover:text-white cursor-pointer">
                            <FaUserPlus /> Invite people
                        </button>
                    )}
                </div>

                <div className="p-3 border-t border-teal-700 text-sm flex items-center justify-between">
                    <Link to="/profile" className="truncate hover:underline" title="Edit profile">{user.name}</Link>
                    <button onClick={onLogout} className="cursor-pointer text-teal-200 hover:text-white text-xs">Log out</button>
                </div>
            </aside>
        </>
    )
}

