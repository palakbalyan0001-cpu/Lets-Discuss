require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");

const connectdb = require("./config/db");
const migrate = require("./utils/migrate");
const authroutes = require("./routes/auth");
const workspacesroutes = require("./routes/workspaces");
const channelroutes = require("./routes/channels");
const dmroutes = require("./routes/dms");
const messageroutes = require("./routes/messages");
const searchroutes = require("./routes/search");
const webhookroutes = require("./routes/webhooks");
const registerSocket = require("./socket");

const CLIENT_URL = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, ""); // no trailing slash

const app = express();
// Render/Railway/Vercel put a proxy in front of the app: needed for secure cookies and rate-limit IPs
app.set("trust proxy", 1);
// cross-origin resource policy: the React app (another origin) must be able to show uploaded images
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.urlencoded({ extended: true }));
// keep the raw body: GitHub webhook signatures are computed over it
app.use(express.json({ limit: "1mb", verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(cookieParser());
app.use(cors({ origin: CLIENT_URL, credentials: true }));

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/auth", authroutes);
app.use("/workspaces", workspacesroutes);
app.use("/channels", channelroutes);
app.use("/dms", dmroutes);
app.use("/search", searchroutes);
app.use("/webhooks", webhookroutes);
app.use("/", messageroutes); // /messages/* and /files/*

// Unknown routes + central error handler (so requests never hang)
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use((err, req, res, next) => {
  console.log(err);
  res.status(err.status || 500).json({ success: false, message: err.status ? err.message : "Something went wrong" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_URL, credentials: true },
});
app.set("io", io);
registerSocket(io);

const PORT = process.env.PORT || 3000;
connectdb().then(async () => {
  await migrate();
  server.listen(PORT, () => console.log("server started", PORT));
});
