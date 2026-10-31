# Let's Discuss

A Slack-style team chat app built with the MERN stack: workspaces, channels, direct messages,
file sharing, search, notifications, GitHub integration and video calls.

**Stack:** React 19 + Redux Toolkit + Tailwind (Vite) · Node.js + Express · MongoDB (Mongoose) · Socket.io · WebRTC

## Run it

```bash
# 1) Backend
cd Backend
npm install
cp .env.example .env      # if you already have a .env, just add the new keys from .env.example
npm run dev               # or: node app.js   (http://localhost:3000)

# 2) Frontend (new terminal)
cd Frontend/letsdiscuss
npm install
npm run dev               # http://localhost:5173
```

`Backend/.env`

| Key | Purpose |
|---|---|
| `PORT`, `DATABASE_CON`, `SECRET_KEY` | server port, MongoDB URL, JWT secret |
| `CLIENT_URL` | address of the React app (CORS + invite links), default `http://localhost:5173` |
| `MAIL_USER`, `MAIL_PASS` | Gmail address + Google *App password* for invite emails |
| `OTP_EXPIRY_MINUTES` *(optional)* | how long the signup email code is valid, default `10` |
| `GITHUB_TOKEN` *(optional)* | lets the GitHub panel read private repos / avoids GitHub's anonymous rate limit |
| `PUBLIC_URL` *(optional)* | public address of the server, shown in the GitHub webhook setup |

Frontend: set `VITE_API_URL` (see `.env.example`) only if the backend is not on `http://localhost:3000`.

## Features

- **Auth** - signup with **email OTP verification** (a 6-digit code is emailed; the account is only created once it is entered correctly), login / logout, bcrypt-hashed passwords, JWT in an httpOnly cookie, rate-limited. Login/signup state lives in a **Redux Toolkit** store. Profile page (name, title, change password).
- **Workspaces** - create, join through an invite link or email invite, delete (admin), leave (members). The workspaces page lists **workspaces you created** and **workspaces you were invited to**.
- **Roles** - *Admin* (owner: manages members/roles, deletes channels & workspace), *Member*, *Guest* (limited: only `#general` + 1:1 DMs, can't create channels, invite, upload or start group DMs).
- **Channels** - `#general` is created automatically; create channels, browse / join / leave, admin deletes.
- **Messaging** - real-time (Socket.io), timestamps and day separators, edit / delete, "is typing…", @mention highlight, clickable links.
- **Direct messages** - 1-to-1 (one conversation per pair) and group DMs, full history.
- **Files** - images and documents up to 10 MB. Whitelisted types, real file-signature check, random stored names, downloads only for people who can see the conversation.
- **Search** - messages, files and people, filtered by channel/DM, sender, has file/link, date range. Only searches what you're allowed to see.
- **Notifications** - unread badges, in-app toasts, tab-title counter, optional desktop notifications.
- **GitHub** - link a repository to a channel: see repo stats, latest commits, open PRs and issues, share any item into the chat with one click. GitHub issue/PR links in messages become chips. Optional **webhook**: pushes, pull requests, issues and comments are posted into the channel automatically (signature-verified).
- **Video calls** - start a call in any channel or DM (up to 6 people): camera, mic mute, screen share. WebRTC peer-to-peer; Socket.io only does the signalling.

## Notes

- **Signup OTP** - `MAIL_USER` / `MAIL_PASS` must be set, because the code is sent by email. While developing without them, the server prints the code in its console (never in production). Codes are stored only as a hash, expire after 10 minutes, allow 5 wrong tries, and can be re-sent every 30 seconds (max 5 per signup).
- **GitHub webhooks** need a public URL. For local testing use a tunnel (e.g. `ngrok http 3000`), set `PUBLIC_URL` to it, then follow the "Live updates setup" box in the channel's GitHub panel.
- **Video calls** need HTTPS (or `localhost`) for camera access. The app uses Google's public STUN servers; behind strict firewalls a TURN server is needed (add it to `ICE` in `src/hooks/useCall.js`). Mesh calls are meant for small groups.
- **Uploads** are stored in `Backend/uploads` (git-ignored). For production use object storage and serve the app over HTTPS from one domain (the login cookie must be same-site for image previews).
- Channels created by the first version of the app are upgraded automatically on server start.

## Structure

```
Backend/   app.js · routes/ · controllers/ · models/ · middleware/ · socket/ · utils/ · uploads/
Frontend/letsdiscuss/src/  store/ (Redux) · api/ · screens/ · components/chat/ · hooks/useCall.js
```
