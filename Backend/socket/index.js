const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { getConversation, getWorkspaceForMember } = require("../utils/access");
const { createMessage, room } = require("../utils/messages");

// Read the "token" cookie from the socket handshake
const tokenFromCookie = (header = "") => {
  const part = header.split(";").map((s) => s.trim()).find((s) => s.startsWith("token="));
  return part ? decodeURIComponent(part.slice(6)) : null;
};

const MAX_CALL_SIZE = 6; // WebRTC mesh: every person connects to every other person

module.exports = (io) => {
  // active calls: "kind:id" -> { peers: Map(socketId -> {userId,name}), recipients: [userId], workspaceId, hostSocketId }
  const calls = new Map();

  io.use((socket, next) => {
    const token = tokenFromCookie(socket.handshake.headers.cookie);
    if (!token) return next(new Error("Unauthorized"));
    try {
      socket.user = jwt.verify(token, process.env.SECRET_KEY);
      next();
    } catch (e) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const ack = (cb, payload) => typeof cb === "function" && cb(payload);
    const userId = String(socket.user.id);
    socket.join(`user:${userId}`); // personal room: notifications, DM + call alerts
    socket.data.calls = new Set();
    try {
      const u = await User.findById(userId).select("name");
      socket.data.name = u ? u.name : "Someone";
    } catch (e) {
      socket.data.name = "Someone";
    }

    // ---- live workspace updates (new channels, members, ...) ----
    socket.on("workspace:join", async ({ workspaceId } = {}) => {
      try {
        if (await getWorkspaceForMember(workspaceId, userId)) socket.join(`workspace:${workspaceId}`);
      } catch (e) { console.log(e); }
    });

    // ---- open a channel / DM: receive its messages + typing ----
    socket.on("conversation:join", async ({ kind, id } = {}, cb) => {
      try {
        const conv = await getConversation(kind, id, userId);
        if (!conv) return ack(cb, { success: false });
        socket.join(room(kind, id));
        ack(cb, { success: true });
      } catch (e) { console.log(e); ack(cb, { success: false }); }
    });
    socket.on("conversation:leave", ({ kind, id } = {}) => {
      if (kind && id) socket.leave(room(kind, id));
    });

    socket.on("message:send", async ({ kind, id, text } = {}, cb) => {
      try {
        const body = String(text || "").trim();
        if (!body) return ack(cb, { success: false, message: "Message is empty" });
        if (body.length > 4000) return ack(cb, { success: false, message: "Message too long" });
        const conv = await getConversation(kind, id, userId);
        if (!conv) return ack(cb, { success: false, message: "You can't post here" });
        await createMessage({ io, conv, sender: userId, text: body });
        ack(cb, { success: true });
      } catch (e) {
        console.log(e);
        ack(cb, { success: false, message: "Could not send message" });
      }
    });

    // ---- typing indicator (only for people who opened the conversation) ----
    socket.on("typing", ({ kind, id, isTyping } = {}) => {
      const r = room(kind, id);
      if (!socket.rooms.has(r)) return;
      socket.to(r).emit("typing", { kind, id, userId, name: socket.data.name, isTyping: !!isTyping });
    });

    // ---- video / audio calls: Socket.io is only the "signalling" channel, media flows peer-to-peer ----
    const callRoom = (key) => `call:${key}`;

    // End the call for EVERYBODY: people inside it are kicked out, and people who never joined
    // (still seeing the "Join call" banner / toast) are told it is over.
    const endCallForAll = (key, call, byName) => {
      const [kind, id] = key.split(":");
      io.to(callRoom(key)).emit("call:force-end", { key, by: byName });
      call.peers.forEach((_, sid) => {
        const s = io.sockets.sockets.get(sid);
        if (s) { s.data.calls.delete(key); s.leave(callRoom(key)); }
      });
      calls.delete(key);
      call.recipients.forEach((uid) =>
        io.to(`user:${uid}`).emit("call:ended", { kind, id, workspaceId: call.workspaceId })
      );
    };

    const leaveCall = (key) => {
      const call = calls.get(key);
      if (!call || !call.peers.has(socket.id)) return;

      // the person who started the call hangs up -> the call ends for everyone
      if (call.hostSocketId === socket.id) {
        call.peers.delete(socket.id);
        socket.data.calls.delete(key);
        socket.leave(callRoom(key));
        return endCallForAll(key, call, socket.data.name);
      }

      call.peers.delete(socket.id);
      socket.data.calls.delete(key);
      socket.leave(callRoom(key));
      io.to(callRoom(key)).emit("call:peer-left", { key, socketId: socket.id });
      if (call.peers.size === 0) {
        calls.delete(key);
        const [kind, id] = key.split(":");
        call.recipients.forEach((uid) =>
          io.to(`user:${uid}`).emit("call:ended", { kind, id, workspaceId: call.workspaceId })
        );
      }
    };

    socket.on("call:join", async ({ kind, id } = {}, cb) => {
      try {
        const conv = await getConversation(kind, id, userId);
        if (!conv) return ack(cb, { success: false, message: "You can't join this call" });
        const key = `${kind}:${id}`;
        let call = calls.get(key);
        const starting = !call;
        if (!call) {
          call = {
            peers: new Map(), recipients: conv.recipients, workspaceId: String(conv.workspace._id),
            hostSocketId: socket.id, // whoever starts the call is the host: if they hang up, the call ends for all
          };
          calls.set(key, call);
        }
        if (call.peers.size >= MAX_CALL_SIZE && !call.peers.has(socket.id)) {
          return ack(cb, { success: false, message: `Call is full (max ${MAX_CALL_SIZE} people)` });
        }
        const peers = [...call.peers.entries()].map(([socketId, p]) => ({ socketId, ...p }));
        call.peers.set(socket.id, { userId, name: socket.data.name });
        socket.data.calls.add(key);
        socket.join(callRoom(key));
        socket.to(callRoom(key)).emit("call:peer-joined", { key, socketId: socket.id, userId, name: socket.data.name });
        if (starting) {
          call.recipients.forEach((uid) => {
            if (uid !== userId) {
              io.to(`user:${uid}`).emit("call:started", {
                kind, id, workspaceId: call.workspaceId, by: socket.data.name,
              });
            }
          });
          // let my other tabs/devices + everybody see the banner too
          io.to(`user:${userId}`).emit("call:started", { kind, id, workspaceId: call.workspaceId, by: socket.data.name });
        }
        ack(cb, { success: true, peers, isHost: call.hostSocketId === socket.id });
      } catch (e) { console.log(e); ack(cb, { success: false, message: "Could not join call" }); }
    });

    // relay WebRTC offers / answers / ICE candidates between two people in the same call
    socket.on("call:signal", ({ key, to, data } = {}) => {
      const call = calls.get(key);
      if (!call || !call.peers.has(socket.id) || !call.peers.has(to)) return;
      io.to(to).emit("call:signal", { key, from: socket.id, data });
    });

    socket.on("call:leave", ({ kind, id } = {}) => leaveCall(`${kind}:${id}`));

    socket.on("call:status", async ({ kind, id } = {}, cb) => {
      try {
        if (!(await getConversation(kind, id, userId))) return ack(cb, { active: false, count: 0 });
        const call = calls.get(`${kind}:${id}`);
        ack(cb, { active: !!call, count: call ? call.peers.size : 0 });
      } catch (e) { ack(cb, { active: false, count: 0 }); }
    });

    socket.on("disconnect", () => {
      [...socket.data.calls].forEach(leaveCall);
    });
  });
};
