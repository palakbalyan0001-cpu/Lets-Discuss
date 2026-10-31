import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import Button from "../../components/Button"
import { getInviteInfo, joinWorkspace } from "../../api/workspaces"
import { getErrorMessage } from "../../api/axios"

export default function Join() {
    const { code } = useParams()
    const navigate = useNavigate()
    const [info, setInfo] = useState(null)
    const [error, setError] = useState("")
    const [joining, setJoining] = useState(false)

    useEffect(() => {
        getInviteInfo(code)
            .then((res) => setInfo(res.data.data))
            .catch((e) => setError(getErrorMessage(e)))
    }, [code])

    const handleJoin = async () => {
        try {
            setJoining(true)
            const res = await joinWorkspace(code)
            navigate(`/workspaces/${res.data.data._id}`, { replace: true })
        } catch (e) {
            setError(getErrorMessage(e))
            setJoining(false)
        }
    }

    return (
        <div className="min-h-screen w-full bg-gray-100 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
                <img src="/logo.png" className="h-16 w-52 mx-auto" />
                {error && <p className="text-red-600">{error}</p>}
                {!info && !error && <p className="text-slate-500">Checking invite...</p>}
                {info && (
                    <>
                        <p className="text-slate-500">You've been invited to join</p>
                        <h1 className="text-2xl font-bold">{info.name}</h1>
                        <p className="text-sm text-slate-500">{info.memberCount} member{info.memberCount === 1 ? "" : "s"}</p>
                        {info.alreadyMember ? (
                            <Link to={`/workspaces/${info._id}`}>
                                <Button text="You're already in - open it" bgcolor="bg-[#00694c]" color="text-teal-100" width="w-full" />
                            </Link>
                        ) : (
                            <Button onclick={handleJoin} text={joining ? "Joining..." : "Join workspace"} bgcolor="bg-[#00694c]" color="text-teal-100" width="w-full" />
                        )}
                    </>
                )}
                <div><Link to="/workspaces" className="text-sm text-[#00694c]">Back to my workspaces</Link></div>
            </div>
        </div>
    )
}
