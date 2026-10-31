import axios from "axios"

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

export const api = axios.create({
    baseURL: API_URL,
    withCredentials: true
})

// Pull a readable message out of a failed request
export const getErrorMessage = (error, fallback = "Something went wrong") =>
    error?.response?.data?.message || (error?.request ? "Cannot reach the server" : fallback)
