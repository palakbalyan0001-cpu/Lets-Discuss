import { Link, useNavigate } from "react-router-dom"
import { useDispatch, useSelector } from "react-redux"
import * as yup from "yup"
import { useEffect, useRef, useState } from "react"
import Form from "../../components/Form"
import { signupfield } from "../../data/signupfield"
import Navbar from "../../components/Navbar"
import { signupUser, verifyOtp, resendOtp, clearAuthError } from "../../store/authSlice"

// Step 2 of signup: enter the 6-digit code that was emailed
function OtpStep({ email, expiresIn, startCooldown, onBack, onVerified }) {
    const dispatch = useDispatch()
    const { error, status } = useSelector((s) => s.auth)
    const [otp, setOtp] = useState("")
    const [cooldown, setCooldown] = useState(startCooldown)
    const [info, setInfo] = useState("")
    const [resendError, setResendError] = useState("")
    const inputRef = useRef(null)

    useEffect(() => { inputRef.current?.focus() }, [])
    useEffect(() => {
        if (cooldown <= 0) return
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
        return () => clearTimeout(t)
    }, [cooldown])

    const submit = async (e) => {
        e.preventDefault()
        setInfo(""); setResendError("")
        if (otp.length !== 6) return
        const r = await dispatch(verifyOtp({ email, otp }))
        if (verifyOtp.fulfilled.match(r)) onVerified()
        else setOtp("")
    }

    const resend = async () => {
        dispatch(clearAuthError()); setInfo(""); setResendError("")
        const r = await dispatch(resendOtp({ email }))
        if (resendOtp.fulfilled.match(r)) {
            setCooldown(r.payload.resendAfter || 30)
            setInfo("A new code is on its way.")
            setOtp("")
        } else {
            setResendError(r.payload?.message || "Could not resend the code")
            if (r.payload?.retryAfter) setCooldown(r.payload.retryAfter)
        }
    }

    return (
        <form onSubmit={submit} className="space-y-4 w-72">
            <h2 className="text-xl font-bold">Check your email</h2>
            <p className="text-sm text-slate-600">
                We sent a 6-digit code to <b className="break-all">{email}</b>. It expires in {expiresIn} minutes.
            </p>
            <input
                ref={inputRef}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="------"
                aria-label="6-digit verification code"
                className="w-full text-center text-3xl tracking-[0.5em] font-mono border border-gray-400 rounded-lg py-2 focus:outline-teal-600"
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            {resendError && <p className="text-red-600 text-sm">{resendError}</p>}
            {info && <p className="text-green-700 text-sm">{info}</p>}
            <button type="submit" disabled={otp.length !== 6 || status === "loading"}
                className="w-full bg-[#00694c] text-teal-100 rounded-lg py-2 font-semibold cursor-pointer disabled:opacity-50">
                {status === "loading" ? "Verifying..." : "Verify & create account"}
            </button>
            <div className="text-sm text-slate-600 flex items-center justify-between">
                <button type="button" onClick={onBack} className="text-[#00694c] cursor-pointer">← Change email</button>
                {cooldown > 0
                    ? <span className="text-slate-400">Resend code in {cooldown}s</span>
                    : <button type="button" onClick={resend} className="text-[#00694c] font-medium cursor-pointer">Resend code</button>}
            </div>
        </form>
    )
}

export default function Signup() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { error } = useSelector((s) => s.auth);
    const [step, setStep] = useState("form") // "form" -> "otp"
    const [sent, setSent] = useState(null)   // { email, expiresInMinutes, resendAfter }

    useEffect(() => { dispatch(clearAuthError()) }, [dispatch])

    const handleSubmit = async (values) => {
        const result = await dispatch(signupUser(values))
        if (signupUser.fulfilled.match(result)) {
            setSent(result.payload)
            setStep("otp")
        }
    }

    const initialValues = { fullname: "", email: "", password: "", conpassword: "" };

    const registerschema = yup.object({
        fullname: yup.string().trim().required("Enter your name").min(2, "Name is too short").max(40, "Name is too long"),
        email: yup.string().required("Enter your email").email("Invalid email format"),
        password: yup.string().required("Password is required")
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/,
                "Min 8 characters with upper, lower, number and a symbol"),
        conpassword: yup.string().required("Confirm password is required").oneOf([yup.ref("password")], "Passwords do not match")
    })
    return (
        <>
            <Navbar />
            <div className="flex min-h-screen w-full items-center justify-center bg-gray-100">
                <div className="rounded-3xl bg-white p-6 shadow-lg text-center">
                    <img src="/logo.png" className="h-20 w-60" />
                    {step === "form" ? (
                        <>
                            <Form data={signupfield} validation={registerschema} buttontext="Sign Up" initialState={initialValues} submitAction={handleSubmit}></Form>
                            {error ? <p className="text-red-600 pt-2">{error}</p> : null}
                            <p className="p-4">Have an account?<Link to="/login" className="text-teal-800"> Sign In</Link></p>
                        </>
                    ) : (
                        <OtpStep
                            email={sent.email}
                            expiresIn={sent.expiresInMinutes}
                            startCooldown={sent.resendAfter}
                            onBack={() => { dispatch(clearAuthError()); setStep("form") }}
                            onVerified={() => navigate("/workspaces", { replace: true })}
                        />
                    )}
                </div>
            </div>
        </>
    )
}
