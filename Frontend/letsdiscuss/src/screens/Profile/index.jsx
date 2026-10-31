import { useState } from "react"
import { Link } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import { changePassword, updateProfile } from "../../store/authSlice"

const inputCls = "border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-teal-600"

function Msg({ m }) {
    return m ? <p className={`text-sm ${m.ok ? "text-green-700" : "text-red-600"}`}>{m.text}</p> : null
}

export default function Profile() {
    const dispatch = useDispatch()
    const { user } = useSelector((s) => s.auth)
    const [name, setName] = useState(user?.name || "")
    const [title, setTitle] = useState(user?.title || "")
    const [profileMsg, setProfileMsg] = useState(null)
    const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" })
    const [pwMsg, setPwMsg] = useState(null)

    const saveProfile = async (e) => {
        e.preventDefault()
        const r = await dispatch(updateProfile({ name, title }))
        setProfileMsg(updateProfile.fulfilled.match(r) ? { ok: true, text: "Profile saved" } : { ok: false, text: r.payload })
    }

    const savePassword = async (e) => {
        e.preventDefault()
        if (pw.newPassword !== pw.confirm) return setPwMsg({ ok: false, text: "Passwords do not match" })
        const r = await dispatch(changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }))
        if (changePassword.fulfilled.match(r)) {
            setPw({ currentPassword: "", newPassword: "", confirm: "" })
            setPwMsg({ ok: true, text: "Password updated" })
        } else setPwMsg({ ok: false, text: r.payload })
    }

    return (
        <div className="min-h-screen bg-gray-100 py-10 px-4">
            <div className="max-w-lg mx-auto space-y-6">
                <Link to="/workspaces" className="text-[#00694c] font-medium">← Back to workspaces</Link>

                <form onSubmit={saveProfile} className="bg-white rounded-2xl shadow p-6 space-y-3">
                    <h1 className="text-2xl font-bold">Your profile</h1>
                    <p className="text-sm text-slate-500">{user?.email}</p>
                    <label className="block text-sm font-medium">Full name
                        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
                    </label>
                    <label className="block text-sm font-medium">Job title (optional)
                        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="e.g. Frontend developer" />
                    </label>
                    <Msg m={profileMsg} />
                    <button className="bg-[#00694c] text-white rounded-lg px-4 py-2 cursor-pointer">Save profile</button>
                </form>

                <form onSubmit={savePassword} className="bg-white rounded-2xl shadow p-6 space-y-3">
                    <h2 className="text-xl font-bold">Change password</h2>
                    <input type="password" className={inputCls} placeholder="Current password" value={pw.currentPassword}
                        onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
                    <input type="password" className={inputCls} placeholder="New password (min 8 characters)" value={pw.newPassword}
                        onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
                    <input type="password" className={inputCls} placeholder="Confirm new password" value={pw.confirm}
                        onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
                    <Msg m={pwMsg} />
                    <button className="bg-[#00694c] text-white rounded-lg px-4 py-2 cursor-pointer">Update password</button>
                </form>
            </div>
        </div>
    )
}
