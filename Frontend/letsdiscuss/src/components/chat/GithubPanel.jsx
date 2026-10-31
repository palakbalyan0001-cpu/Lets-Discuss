import { useCallback, useEffect, useState } from "react"
import { FaCodeBranch, FaExclamationCircle, FaGithub, FaShareSquare, FaStar } from "react-icons/fa"
import { getGithub, getGithubWebhook, linkGithub, unlinkGithub } from "../../api/chat"
import { getErrorMessage } from "../../api/axios"

export default function GithubPanel({ channel, canManage, onShare, onChanged }) {
    const repo = channel.github?.repo
    const [data, setData] = useState(null)
    const [tab, setTab] = useState("commits")
    const [input, setInput] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [webhook, setWebhook] = useState(null)

    const load = useCallback(async () => {
        if (!repo) return
        setLoading(true)
        try { setData((await getGithub(channel._id)).data.data); setError("") } catch (e) { setData(null); setError(getErrorMessage(e)) }
        setLoading(false)
    }, [channel._id, repo])

    useEffect(() => { setData(null); setWebhook(null); load() }, [load])

    const link = async (e) => {
        e.preventDefault()
        try {
            const r = await linkGithub(channel._id, input)
            setWebhook(r.data.webhook); setInput(""); setError(""); onChanged()
        } catch (err) { setError(getErrorMessage(err)) }
    }
    const unlink = async () => {
        if (!confirm(`Unlink ${repo} from #${channel.name}?`)) return
        try { await unlinkGithub(channel._id); setData(null); setWebhook(null); onChanged() } catch (err) { setError(getErrorMessage(err)) }
    }
    const showWebhook = async () => {
        try { setWebhook((await getGithubWebhook(channel._id)).data.webhook) } catch (err) { setError(getErrorMessage(err)) }
    }

    if (!repo) {
        return (
            <div className="p-4 space-y-3">
                <h3 className="font-bold flex items-center gap-2"><FaGithub /> GitHub</h3>
                <p className="text-sm text-slate-500">Link a repository to #{channel.name} to see commits, pull requests and issues here and get live updates in the chat.</p>
                {canManage ? (
                    <form onSubmit={link} className="space-y-2">
                        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="owner/repo or GitHub URL" className="w-full border border-gray-300 rounded p-2 text-sm" />
                        <button className="bg-slate-900 text-white rounded px-3 py-1.5 text-sm cursor-pointer">Link repository</button>
                    </form>
                ) : <p className="text-xs text-slate-400">Guests can't link repositories.</p>}
                {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
        )
    }

    const items = data ? (tab === "commits" ? data.commits : tab === "pulls" ? data.pulls : data.issues) : []
    return (
        <div className="p-4 space-y-3">
            <h3 className="font-bold flex items-center gap-2"><FaGithub /> GitHub</h3>
            <div>
                <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline break-all">{repo}</a>
                {data?.description && <p className="text-sm text-slate-600">{data.description}</p>}
                {data && (
                    <p className="text-xs text-slate-500 flex gap-3 mt-1">
                        <span className="flex items-center gap-1"><FaStar /> {data.stars}</span>
                        <span className="flex items-center gap-1"><FaCodeBranch /> {data.forks}</span>
                        <span className="flex items-center gap-1"><FaExclamationCircle /> {data.openIssues}</span>
                        {data.language && <span>{data.language}</span>}
                    </p>
                )}
            </div>
            {error && <p className="text-red-600 text-sm">{error} <button onClick={load} className="underline cursor-pointer">Retry</button></p>}
            {loading && <p className="text-sm text-slate-400">Loading...</p>}
            {data && (
                <>
                    <div className="flex gap-1 text-sm">
                        {[["commits", "Commits"], ["pulls", "Pull requests"], ["issues", "Issues"]].map(([k, label]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-2 py-1 rounded cursor-pointer ${tab === k ? "bg-slate-900 text-white" : "bg-slate-100"}`}>{label}</button>
                        ))}
                    </div>
                    <ul className="divide-y">
                        {items.map((it) => (
                            <li key={it.url} className="py-2 flex gap-2 items-start">
                                <div className="min-w-0 flex-1">
                                    <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline break-words">
                                        {tab === "commits" ? it.message : `#${it.number} ${it.title}`}
                                    </a>
                                    <p className="text-xs text-slate-500">{tab === "commits" ? `${it.sha} · ${it.author}` : it.user}{it.draft ? " · draft" : ""}</p>
                                </div>
                                <button title="Share in chat" onClick={() => onShare(it.url)} className="text-slate-400 hover:text-[#00694c] cursor-pointer"><FaShareSquare /></button>
                            </li>
                        ))}
                        {items.length === 0 && <li className="py-3 text-sm text-slate-400">Nothing to show.</li>}
                    </ul>
                </>
            )}
            <div className="flex gap-3 text-xs pt-2 border-t">
                <button onClick={showWebhook} className="text-slate-600 hover:underline cursor-pointer">Live updates setup</button>
                {canManage && <button onClick={unlink} className="text-red-600 hover:underline cursor-pointer">Unlink</button>}
            </div>
            {webhook && (
                <div className="bg-slate-50 border rounded p-3 text-xs space-y-2 break-words">
                    <p className="font-semibold">Get live push / PR / issue updates in this channel</p>
                    <p>In GitHub: Settings → Webhooks → Add webhook</p>
                    <p><b>Payload URL:</b> <span className="break-all select-all">{webhook.url}</span></p>
                    <p><b>Content type:</b> application/json</p>
                    <p><b>Secret:</b> <span className="break-all select-all">{webhook.secret}</span></p>
                    <p><b>Events:</b> Pushes, Pull requests, Issues, Issue comments</p>
                    <p className="text-slate-500">The URL must be reachable from the internet (deploy the server or use a tunnel such as ngrok and set PUBLIC_URL).</p>
                </div>
            )}
        </div>
    )
}
