import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import * as authApi from "../api/auth"
import { getErrorMessage } from "../api/axios"

// Each thunk resolves with the user (or a readable error message when rejected)
export const fetchMe = createAsyncThunk("auth/fetchMe", async (_, { rejectWithValue }) => {
    try { return (await authApi.me()).data.user } catch { return rejectWithValue(null) }
})
export const loginUser = createAsyncThunk("auth/login", async (values, { rejectWithValue }) => {
    try { return (await authApi.login(values)).data.user } catch (e) { return rejectWithValue(getErrorMessage(e)) }
})
// errors from the signup / OTP calls also carry "retryAfter" (seconds) when the server rate-limits
const errPayload = (e) => ({ message: getErrorMessage(e), retryAfter: e?.response?.data?.retryAfter })

// Step 1 of signup: the server emails a 6-digit code (the account is created after it is verified)
export const signupUser = createAsyncThunk("auth/signup", async (values, { rejectWithValue }) => {
    try { return (await authApi.signup(values)).data } catch (e) { return rejectWithValue(errPayload(e)) }
})
// Step 2: send the code; on success the user is created and logged in
export const verifyOtp = createAsyncThunk("auth/verifyOtp", async (values, { rejectWithValue }) => {
    try { return (await authApi.verifyOtp(values)).data.user } catch (e) { return rejectWithValue(errPayload(e)) }
})
export const resendOtp = createAsyncThunk("auth/resendOtp", async (values, { rejectWithValue }) => {
    try { return (await authApi.resendOtp(values)).data } catch (e) { return rejectWithValue(errPayload(e)) }
})
export const logoutUser = createAsyncThunk("auth/logout", async () => {
    try { await authApi.logout() } catch (e) { console.log(e) }
})
export const updateProfile = createAsyncThunk("auth/updateProfile", async (values, { rejectWithValue }) => {
    try { return (await authApi.updateProfile(values)).data.user } catch (e) { return rejectWithValue(getErrorMessage(e)) }
})
export const changePassword = createAsyncThunk("auth/changePassword", async (values, { rejectWithValue }) => {
    try { return (await authApi.changePassword(values)).data.message } catch (e) { return rejectWithValue(getErrorMessage(e)) }
})

const authSlice = createSlice({
    name: "auth",
    initialState: {
        user: null,
        checking: true,   // true until the first /auth/me answer arrives
        status: "idle",   // idle | loading  (login / signup in progress)
        error: null,
    },
    reducers: {
        clearAuthError(state) { state.error = null },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchMe.fulfilled, (s, a) => { s.user = a.payload; s.checking = false })
            .addCase(fetchMe.rejected, (s) => { s.user = null; s.checking = false })
            .addCase(loginUser.pending, (s) => { s.status = "loading"; s.error = null })
            .addCase(loginUser.fulfilled, (s, a) => { s.status = "idle"; s.user = a.payload })
            .addCase(loginUser.rejected, (s, a) => { s.status = "idle"; s.error = a.payload })
            .addCase(signupUser.pending, (s) => { s.status = "loading"; s.error = null })
            .addCase(signupUser.fulfilled, (s) => { s.status = "idle" })
            .addCase(signupUser.rejected, (s, a) => { s.status = "idle"; s.error = a.payload?.message })
            .addCase(verifyOtp.pending, (s) => { s.status = "loading"; s.error = null })
            .addCase(verifyOtp.fulfilled, (s, a) => { s.status = "idle"; s.user = a.payload })
            .addCase(verifyOtp.rejected, (s, a) => { s.status = "idle"; s.error = a.payload?.message })
            .addCase(logoutUser.fulfilled, (s) => { s.user = null })
            .addCase(updateProfile.fulfilled, (s, a) => { s.user = a.payload })
    },
})

export const { clearAuthError } = authSlice.actions
export default authSlice.reducer
