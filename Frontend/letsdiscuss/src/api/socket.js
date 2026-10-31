import { io } from "socket.io-client"
import { API_URL } from "./axios"

// Connected manually by the chat screen (needs the login cookie)
export const socket = io(API_URL, { withCredentials: true, autoConnect: false })
