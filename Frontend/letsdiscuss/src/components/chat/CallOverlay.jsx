import { useEffect, useRef } from "react"
import { FaDesktop, FaMicrophone, FaMicrophoneSlash, FaPhoneSlash, FaVideo, FaVideoSlash } from "react-icons/fa"
import Avatar from "./Avatar"

// One person's tile. Shows their face; falls back to an avatar when their camera is off / missing.
function Tile({ stream, name, local, camOff, muted, sharing }) {
    const ref = useRef(null)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.srcObject = stream || null
        if (stream) el.play?.().catch(() => {}) // some browsers need an explicit play() for remote streams
    }, [stream])
    const hasVideo = !!stream && !camOff && stream.getVideoTracks().some((t) => t.readyState === "live")
    return (
        <div className="relative bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center aspect-video">
            <video ref={ref} autoPlay playsInline muted={local}
                className={`w-full h-full ${sharing ? "object-contain bg-black" : "object-cover"} ${hasVideo ? "" : "hidden"} ${local && !sharing ? "-scale-x-100" : ""}`} />
            {!hasVideo && <Avatar name={name} size="h-20 w-20 text-3xl" />}
            <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs rounded px-2 py-0.5">{name}{local ? " (you)" : ""}{sharing ? " · sharing screen" : ""}</span>
            {muted && <span className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 text-xs"><FaMicrophoneSlash /></span>}
        </div>
    )
}

const Btn = ({ onClick, active, title, children, danger, wide }) => (
    <button onClick={onClick} title={title}
        className={`h-12 ${wide ? "px-5 gap-2 rounded-full text-sm font-semibold" : "w-12 rounded-full text-lg"} flex items-center justify-center cursor-pointer ${danger ? "bg-red-600 text-white hover:bg-red-700" : active ? "bg-white text-slate-900" : "bg-slate-700 text-white hover:bg-slate-600"}`}>
        {children}
    </button>
)

export default function CallOverlay({ api, title, myName }) {
    if (!api.call) return null
    const peerList = Object.entries(api.peers)
    const count = peerList.length + 1
    const cols = count <= 1 ? "grid-cols-1 max-w-xl" : count <= 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3"
    return (
        <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col">
            <div className="px-5 py-3 text-white flex items-center justify-between">
                <div><p className="font-semibold">{title}</p><p className="text-xs text-slate-300">{count} in call</p></div>
            </div>
            {api.error && (
                <div className="mx-4 bg-amber-100 text-amber-900 text-sm rounded px-3 py-2 flex justify-between">
                    {api.error}<button onClick={api.clearError} className="cursor-pointer ml-3">×</button>
                </div>
            )}
            <div className={`flex-1 overflow-auto p-4 grid ${cols} gap-3 content-center justify-center mx-auto w-full`}>
                <Tile stream={api.localStream} name={myName} local camOff={api.camOff && !api.sharing} muted={api.muted} sharing={api.sharing} />
                {peerList.map(([id, p]) => <Tile key={id} stream={p.stream} name={p.name} camOff={p.camOff && !p.sharing} muted={p.muted} sharing={p.sharing} />)}
            </div>
            {count === 1 && <p className="text-center text-slate-300 text-sm pb-2">Waiting for others to join...</p>}
            <div className="flex justify-center gap-4 p-4">
                <Btn onClick={api.toggleMic} active={api.muted} title={api.muted ? "Unmute" : "Mute"}>
                    {api.muted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                </Btn>
                {/* everybody in the call gets the camera button */}
                <Btn onClick={api.toggleCam} active={api.camOff} title={api.camOff ? "Turn camera on" : "Turn camera off"}>
                    {api.camOff ? <FaVideoSlash /> : <FaVideo />}
                </Btn>
                <Btn onClick={api.toggleShare} active={api.sharing} title={api.sharing ? "Stop sharing" : "Share your screen"}><FaDesktop /></Btn>
                {api.isHost
                    ? <Btn onClick={api.leave} danger wide title="End the call for everyone"><FaPhoneSlash /> End for all</Btn>
                    : <Btn onClick={api.leave} danger title="Leave call"><FaPhoneSlash /></Btn>}
            </div>
        </div>
    )
}
