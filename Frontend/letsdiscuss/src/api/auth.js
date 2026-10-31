import { api } from "./axios";
export const signup = (data) => api.post("/auth/signup", data)
export const verifyOtp = (data) => api.post("/auth/verify-otp", data)
export const resendOtp = (data) => api.post("/auth/resend-otp", data)
export const login = (data) => api.post("/auth/login", data)
export const logout = () => api.post("/auth/logout")
export const me = () => api.get("/auth/me")
export const updateProfile = (data) => api.patch("/auth/profile", data)
export const changePassword = (data) => api.patch("/auth/password", data)
