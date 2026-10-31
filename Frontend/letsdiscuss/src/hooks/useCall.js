import { useCallback, useEffect, useRef, useState } from "react"
import { socket } from "../api/socket"

// STUN lets browsers find each other. Add a TURN server here for strict corporate networks.
const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] }

/**
 * Video / audio calls with WebRTC (mesh: everybody connects to everybody, up to 6 people).
 * Socket.io only carries the signalling; audio and video flow directly between browsers.
 *
 * - Every person in the call sends AND receives video, so everybody sees everybody's face.
 * - If the person who started the call hangs up, the server ends the call for everyone.
 * - Camera / mic on-off is shared with the others so they show an avatar instead of a black box.
 */
export default function useCall() {
    const [call, setCall] = useState(null)            // { kind, id, key }
    const [localStream, setLocalStream] = useState(null)
    const [peers, setPeers] = useState({})            // socketId -> { name, stream, camOff, muted }
    const [muted, setMuted] = useState(false)
    const [camOff, setCamOff] = useState(false)
    const [sharing, setSharing] = useState(false)
    const [isHost, setIsHost] = useState(false)      // I started the call: if I hang up it ends for everybody
    const [error, setError] = useState("")

    const pcs = useRef({})            // socketId -> RTCPeerConnection
    const negotiation = useRef({})    // socketId -> { makingOffer, ignoreOffer, polite }
    const pending = useRef({})        // ICE candidates that arrived before the remote description
    const remoteStreams = useRef({})  // socketId -> MediaStream we build from incoming tracks
    const localRef = useRef(null)     // camera + mic stream
    const screenRef = useRef(null)
    const keyRef = useRef(null)
    const callRef = useRef(null)
    const stateRef = useRef({ muted: false, camOff: false, sharing: false })

    const send = (to, data) => socket.emit("call:signal", { key: keyRef.current, to, data })
    const sendState = (to) => send(to, { type: "state", ...stateRef.current })
    const broadcastState = () => Object.keys(pcs.current).forEach(sendState)
    const patchPeer = (socketId, patch) => setPeers((p) => (p[socketId] ? { ...p, [socketId]: { ...p[socketId], ...patch } } : p))

    const removePeer = useCallback((socketId) => {
        const pc = pcs.current[socketId]
        if (pc) {
            pc.onicecandidate = null; pc.ontrack = null; pc.onnegotiationneeded = null; pc.onconnectionstatechange = null
            pc.close()
        }
        delete pcs.current[socketId]
        delete negotiation.current[socketId]
        delete pending.current[socketId]
        delete remoteStreams.current[socketId]
        setPeers((p) => { const n = { ...p }; delete n[socketId]; return n })
    }, [])

    const makePeer = useCallback((socketId, name) => {
        if (pcs.current[socketId]) {
            if (name) patchPeer(socketId, { name })
            return pcs.current[socketId]
        }
        const pc = new RTCPeerConnection(ICE)
        pcs.current[socketId] = pc
        pending.current[socketId] = []
        // the one with the "bigger" socket id is polite: it gives way if both sides send an offer at once
        negotiation.current[socketId] = { makingOffer: false, ignoreOffer: false, polite: socket.id > socketId }
        remoteStreams.current[socketId] = new MediaStream()

        // Always have an audio AND a video m-line, even if I have no camera right now,
        // so I can still SEE everybody else (and turn my own camera on later).
        const local = localRef.current
        ;["audio", "video"].forEach((kind) => {
            const track = local?.getTracks().find((t) => t.kind === kind)
            if (track) pc.addTrack(track, local)
            else pc.addTransceiver(kind, { direction: "recvonly" })
        })

        pc.onicecandidate = (e) => e.candidate && send(socketId, { type: "candidate", candidate: e.candidate })
        pc.ontrack = (e) => {
            const stream = remoteStreams.current[socketId]
            if (!stream) return
            if (!stream.getTracks().includes(e.track)) stream.addTrack(e.track)
            // re-render when the remote track starts/stops sending frames
            e.track.onunmute = e.track.onmute = e.track.onended = () => setPeers((p) => (p[socketId] ? { ...p, [socketId]: { ...p[socketId] } } : p))
            setPeers((p) => ({ ...p, [socketId]: { ...p[socketId], stream, v: (p[socketId]?.v || 0) + 1 } }))
        }
        pc.onnegotiationneeded = async () => {
            const n = negotiation.current[socketId]
            if (!n) return
            try {
                n.makingOffer = true
                await pc.setLocalDescription()
                send(socketId, { type: "description", description: pc.localDescription })
            } catch (e) { console.log("negotiation error", e) }
            finally { n.makingOffer = false }
        }
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") sendState(socketId)
            if (pc.connectionState === "failed" || pc.connectionState === "closed") removePeer(socketId)
        }
        setPeers((p) => ({ ...p, [socketId]: { name: name || "Guest", stream: remoteStreams.current[socketId], camOff: true, muted: false, sharing: false } })) // camOff until their state arrives, so no black box
        return pc
    }, [removePeer])

    const flushCandidates = async (socketId, pc) => {
        const list = pending.current[socketId] || []
        pending.current[socketId] = []
        for (const c of list) { try { await pc.addIceCandidate(c) } catch (e) { console.log(e) } }
    }

    const handleSignal = useCallback(async ({ key, from, data }) => {
        if (key !== keyRef.current || !data) return
        try {
            const pc = pcs.current[from] || makePeer(from, null)
            const n = negotiation.current[from]
            if (data.type === "state") {
                return patchPeer(from, { camOff: !!data.camOff, muted: !!data.muted, sharing: !!data.sharing })
            }
            if (data.type === "description") {
                const d = data.description
                const collision = d.type === "offer" && (n.makingOffer || pc.signalingState !== "stable")
                n.ignoreOffer = !n.polite && collision
                if (n.ignoreOffer) return
                await pc.setRemoteDescription(d)
                await flushCandidates(from, pc)
                if (d.type === "offer") {
                    await pc.setLocalDescription()
                    send(from, { type: "description", description: pc.localDescription })
                }
            } else if (data.type === "candidate") {
                if (pc.remoteDescription) {
                    try { await pc.addIceCandidate(data.candidate) } catch (e) { if (!n.ignoreOffer) throw e }
                } else (pending.current[from] ||= []).push(data.candidate)
            }
        } catch (e) { console.log("signal error", e) }
    }, [makePeer])

    const cleanup = useCallback(() => {
        Object.keys(pcs.current).forEach(removePeer)
        localRef.current?.getTracks().forEach((t) => t.stop())
        screenRef.current?.getTracks().forEach((t) => t.stop())
        localRef.current = null
        screenRef.current = null
        keyRef.current = null
        callRef.current = null
        stateRef.current = { muted: false, camOff: false, sharing: false }
        setLocalStream(null); setCall(null); setPeers({})
        setMuted(false); setCamOff(false); setSharing(false); setIsHost(false)
    }, [removePeer])

    const leave = useCallback(() => {
        if (callRef.current) socket.emit("call:leave", { kind: callRef.current.kind, id: callRef.current.id })
        cleanup()
    }, [cleanup])

    const join = useCallback(async (kind, id) => {
        if (callRef.current) return
        setError("")
        if (!navigator.mediaDevices?.getUserMedia) {
            return setError("Calls need HTTPS (or localhost) and a browser with camera support")
        }
        let stream
        let noVideo = false
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        } catch {
            try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); noVideo = true }
            catch { return setError("Allow microphone/camera access to join the call") }
        }
        localRef.current = stream
        setLocalStream(stream)
        setCamOff(noVideo)
        stateRef.current = { muted: false, camOff: noVideo, sharing: false }
        const key = `${kind}:${id}`
        keyRef.current = key
        callRef.current = { kind, id, key }
        setCall(callRef.current)
        if (noVideo) setError("Camera not available - you can still see and hear everyone. Press the camera button to try again.")
        socket.emit("call:join", { kind, id }, (res) => {
            if (!res?.success) {
                setError(res?.message || "Could not join the call")
                cleanup()
                return
            }
            setIsHost(!!res.isHost)
            // existing people will be offered a connection by negotiationneeded
            for (const p of res.peers) makePeer(p.socketId, p.name)
        })
    }, [cleanup, makePeer])

    useEffect(() => {
        const onJoined = ({ key, socketId, name }) => { if (key === keyRef.current) makePeer(socketId, name) }
        const onLeft = ({ key, socketId }) => { if (key === keyRef.current) removePeer(socketId) }
        // the person who started the call hung up -> the call is over for everybody
        const onForceEnd = ({ key, by }) => {
            if (key !== keyRef.current) return
            cleanup()
            setError(by ? `${by} ended the call` : "The call has ended")
        }
        socket.on("call:peer-joined", onJoined)
        socket.on("call:peer-left", onLeft)
        socket.on("call:force-end", onForceEnd)
        socket.on("call:signal", handleSignal)
        socket.on("disconnect", cleanup)
        return () => {
            socket.off("call:peer-joined", onJoined)
            socket.off("call:peer-left", onLeft)
            socket.off("call:force-end", onForceEnd)
            socket.off("call:signal", handleSignal)
            socket.off("disconnect", cleanup)
        }
    }, [makePeer, removePeer, handleSignal, cleanup])

    // leaving the page ends the call
    useEffect(() => () => {
        if (callRef.current) socket.emit("call:leave", { kind: callRef.current.kind, id: callRef.current.id })
        cleanup()
    }, [cleanup])

    const toggleMic = () => {
        const t = localRef.current?.getAudioTracks()[0]
        if (!t) return
        t.enabled = !t.enabled
        stateRef.current.muted = !t.enabled
        setMuted(!t.enabled)
        broadcastState()
    }

    // send a video track (camera or screen) to every person in the call
    const sendVideoTrack = async (track) => {
        await Promise.all(Object.values(pcs.current).map(async (pc) => {
            const tr = pc.getTransceivers().find((t) => t.receiver.track.kind === "video")
            if (!tr) return
            await tr.sender.replaceTrack(track)
            if (track && tr.direction !== "sendrecv") tr.direction = "sendrecv" // triggers renegotiation
        }))
    }

    const toggleCam = async () => {
        const existing = localRef.current?.getVideoTracks()[0]
        if (existing) {
            existing.enabled = !existing.enabled
            stateRef.current.camOff = !existing.enabled
            setCamOff(!existing.enabled)
            broadcastState()
            return
        }
        // I joined without a camera: try to start it now so the others can see my face
        try {
            const cam = await navigator.mediaDevices.getUserMedia({ video: true })
            const track = cam.getVideoTracks()[0]
            localRef.current.addTrack(track)
            if (!sharing) await sendVideoTrack(track)
            stateRef.current.camOff = false
            setCamOff(false)
            setError("")
            setLocalStream(new MediaStream(localRef.current.getTracks()))
            broadcastState()
        } catch { setError("Could not start the camera - check that it is connected and allowed in the browser") }
    }

    const stopShare = useCallback(() => {
        screenRef.current?.getTracks().forEach((t) => t.stop())
        screenRef.current = null
        const cam = localRef.current?.getVideoTracks()[0] || null
        sendVideoTrack(cam)
        stateRef.current.sharing = false
        broadcastState()
        setLocalStream(localRef.current ? new MediaStream(localRef.current.getTracks()) : null)
        setSharing(false)
    }, [])
    const toggleShare = async () => {
        if (sharing) return stopShare()
        try {
            const screen = await navigator.mediaDevices.getDisplayMedia({ video: true })
            const track = screen.getVideoTracks()[0]
            screenRef.current = screen
            track.onended = stopShare
            await sendVideoTrack(track)
            stateRef.current.sharing = true
            broadcastState()
            setLocalStream(new MediaStream([track, ...(localRef.current?.getAudioTracks() || [])]))
            setSharing(true)
        } catch { /* user cancelled the picker */ }
    }

    return {
        call, localStream, peers, muted, camOff, sharing, error, isHost,
        join, leave, toggleMic, toggleCam, toggleShare, clearError: () => setError(""),
    }
}
