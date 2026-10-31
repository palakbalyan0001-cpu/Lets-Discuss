import { useEffect, useRef, useState } from "react"
import { FaPaperclip, FaPaperPlane, FaTimes } from "react-icons/fa"
import { formatSize } from "../../utils/linkify"

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,.pdf,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"

export default function MessageInput({ placeholder, disabled, canUpload, onSend, onUpload, onTyping, typingNames, error }) {
    const [text, setText] = useState("")
    const [file, setFile] = useState(null)
    const [progress, setProgress] = useState(null)
    const fileRef = useRef(null)
    const lastTyping = useRef(0)
    const stopTimer = useRef(null)

    useEffect(() => () => clearTimeout(stopTimer.current), [])

    const handleChange = (e) => {
        setText(e.target.value)
        const now = Date.now()
        if (now - lastTyping.current > 2000) { onTyping(true); lastTyping.current = now }
        clearTimeout(stopTimer.current)
        stopTimer.current = setTimeout(() => { onTyping(false); lastTyping.current = 0 }, 2500)
    }

    const submit = async (e) => {
        e?.preventDefault()
        const body = text.trim()
        if (disabled || (!body && !file)) return
        clearTimeout(stopTimer.current)
        onTyping(false)
        lastTyping.current = 0
        if (file) {
            setProgress(0)
            const ok = await onUpload(file, body, setProgress)
            setProgress(null)
            if (ok) { setFile(null); setText("") }
        } else {
            onSend(body)
            setText("")
        }
    }

    const names = typingNames.length === 0 ? "" : typingNames.length === 1 ? `${typingNames[0]} is typing...` : `${typingNames.slice(0, 2).join(" and ")} are typing...`

    return (
        <form onSubmit={submit} className="border-t border-gray-200 p-3">
            <div className="h-4 text-xs text-slate-500 pb-1">{names}</div>
            {error && <p className="text-red-600 text-xs pb-1">{error}</p>}
            {file && (
                <div className="mb-2 inline-flex items-center gap-2 bg-gray-100 rounded px-3 py-1 text-sm">
                    <FaPaperclip /> {file.name} <span className="text-slate-500">({formatSize(file.size)})</span>
                    {progress === null && <button type="button" onClick={() => setFile(null)} className="cursor-pointer"><FaTimes /></button>}
                    {progress !== null && <span className="text-slate-500">{progress}%</span>}
                </div>
            )}
            <div className="flex gap-2">
                {canUpload && (
                    <>
                        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                            onChange={(e) => { setFile(e.target.files[0] || null); e.target.value = "" }} />
                        <button type="button" title="Attach a file (max 10 MB)" disabled={disabled}
                            onClick={() => fileRef.current.click()}
                            className="border border-gray-300 rounded-lg px-3 text-slate-600 hover:bg-gray-50 cursor-pointer">
                            <FaPaperclip />
                        </button>
                    </>
                )}
                <textarea rows={1} value={text} onChange={handleChange} maxLength={4000} disabled={disabled}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e) }}
                    placeholder={placeholder}
                    className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-teal-600" />
                <button type="submit" disabled={disabled || (!text.trim() && !file) || progress !== null}
                    className="bg-[#00694c] text-white rounded-lg px-4 cursor-pointer disabled:opacity-40 flex items-center gap-2">
                    <FaPaperPlane /> <span className="hidden sm:inline">Send</span>
                </button>
            </div>
        </form>
    )
}
