import { Navigate, useLocation } from "react-router-dom"
import { useSelector } from "react-redux"

export default function ProtectedRoute({ children }) {
    const { user, checking } = useSelector((s) => s.auth)
    const location = useLocation()
    if (checking) return <div className="p-10 text-center text-slate-500">Loading...</div>
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
    return children
}
