import { Navigate, Route, Routes } from "react-router-dom"
import Home from "./screens/Home"
import Signup from "./screens/Signup"
import Login from "./screens/Login"
import Workspaces from "./screens/workspaces"
import Dashboard from "./screens/Dashboard"
import Join from "./screens/Join"
import Profile from "./screens/Profile"
import ProtectedRoute from "./components/ProtectedRoute"

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/workspaces" element={<ProtectedRoute><Workspaces /></ProtectedRoute>} />
      <Route path="/workspaces/:id" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/join/:code" element={<ProtectedRoute><Join /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/dashboard" element={<Navigate to="/workspaces" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
