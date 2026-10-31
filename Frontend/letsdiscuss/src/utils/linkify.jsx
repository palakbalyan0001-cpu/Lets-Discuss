import { FaGithub } from "react-icons/fa"

const URL_RE = /(https?:\/\/[^\s<>"']+)/g
const GH_RE = /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+\/[\w.-]+)\/(pull|issues)\/(\d+)/i
const MENTION_RE = /(@[\w.-]+)/g

const plain = (text, keyBase) =>
    text.split(MENTION_RE).map((part, i) =>
        i % 2 === 1
            ? <span key={`${keyBase}-${i}`} className="bg-emerald-100 text-emerald-800 rounded px-1">{part}</span>
            : part
    )

// Turns URLs into safe links (GitHub issue / PR links become small chips) and highlights @mentions
export function renderText(text) {
    return String(text || "").split(URL_RE).map((part, i) => {
        if (i % 2 === 0) return <span key={i}>{plain(part, i)}</span>
        const url = part.replace(/[.,!?;:)\]]+$/, "")
        const trailing = part.slice(url.length)
        const gh = url.match(GH_RE)
        return (
            <span key={i}>
                <a href={url} target="_blank" rel="noopener noreferrer"
                    className={gh ? "inline-flex items-center gap-1 bg-slate-100 border border-slate-300 rounded px-1.5 text-slate-800 hover:bg-slate-200" : "text-blue-600 underline break-all"}>
                    {gh ? <><FaGithub /> {gh[1]}{gh[2] === "pull" ? " PR " : " issue "}#{gh[3]}</> : url}
                </a>
                {trailing}
            </span>
        )
    })
}

export const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
export const formatDay = (iso) => {
    const d = new Date(iso)
    const today = new Date()
    const y = new Date(); y.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return "Today"
    if (d.toDateString() === y.toDateString()) return "Yesterday"
    return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })
}
export const formatSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
