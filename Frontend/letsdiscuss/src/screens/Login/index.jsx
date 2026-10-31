import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import Form from "../../components/Form"
import Navbar from "../../components/Navbar"
import { loginfield } from "../../data/loginfield"
import { loginUser, clearAuthError } from "../../store/authSlice"
import * as yup from "yup"
import { useEffect } from "react"

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();
    const { user, error } = useSelector((s) => s.auth);
    const redirectTo = location.state?.from || "/workspaces";

    useEffect(() => { dispatch(clearAuthError()) }, [dispatch])

    const InitialValues = { email: "", password: "" }

    // No strength rules on login - only the server decides if the password is right
    const validationschema = yup.object({
        email: yup.string().required("Enter your email").email("Invalid email format"),
        password: yup.string().required("Password is required"),
    })

    const handlesubmit = async (values) => {
        const result = await dispatch(loginUser(values))
        if (loginUser.fulfilled.match(result)) navigate(redirectTo, { replace: true })
    }

    if (user) return <Navigate to={redirectTo} replace />

    return (
        <>
            <Navbar />
            <div className="bg-gray-100 min-h-screen w-full flex items-center justify-center">
                <div className="bg-white p-6 rounded-2xl shadow-2xl text-center">
                    {error ? <p className="text-red-700 p-2 border border-red-300 rounded bg-red-100">{error}</p> : null}
                    <img src="/logo.png" className="h-20 w-60" />
                    <Form data={loginfield} submitAction={handlesubmit} initialState={InitialValues} validation={validationschema} buttontext="Sign In"></Form>
                    <div className="p-2"> New here?
                        <Link to="/signup" className="text-[#00694c] font-medium"> Create an account</Link>
                    </div>
                </div>
            </div>
        </>
    )
}
