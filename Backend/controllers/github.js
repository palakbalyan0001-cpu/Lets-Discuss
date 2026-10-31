const crypto = require("crypto");
const mongoose = require("mongoose");
const Channel = require("../models/channel");
const Workspace = require("../models/workspaces");
const { getChannelForMember, roleOf, same } = require("../utils/access");
const { createMessage } = require("../utils/messages");

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const fail = (res, error) => {
  console.log(error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
};

// Accepts "owner/repo", "https://github.com/owner/repo", ".../repo.git", ".../repo/pull/3"
const parseRepo = (input) => {
  let s = String(input || "").trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\.git$/i, "");
  s = s.split(/[/?#]/).slice(0, 2).join("/");
  return REPO_RE.test(s) ? s : null;
};

// ---- tiny GitHub REST client with a 60s cache (protects the rate limit) ----
const cache = new Map();
const ghFetch = async (p) => {
  const hit = cache.get(p);
  if (hit && Date.now() - hit.at < 60000) return hit.data;
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "lets-discuss" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetch("https://api.github.com" + p, { headers, signal: AbortSignal.timeout(8000) });
  if (!r.ok) {
    const e = new Error("GitHub " + r.status);
    e.status = r.status;
    throw e;
  }
  const data = await r.json();
  cache.set(p, { at: Date.now(), data });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return data;
};
const ghError = (e) =>
  e.status === 404
    ? [404, "Repository not found (private repos need GITHUB_TOKEN on the server)"]
    : e.status === 403 || e.status === 429
    ? [429, "GitHub rate limit reached - set GITHUB_TOKEN on the server"]
    : [502, "Could not reach GitHub"];

const firstLine = (s) => String(s || "").split("\n")[0].slice(0, 200);

// GET /channels/:id/github  -> repo overview, recent commits, open PRs and issues
const getGithubInfo = async (req, res) => {
  try {
    const access = await getChannelForMember(req.params.id, req.user.id);
    if (!access) return res.status(404).json({ success: false, message: "Channel not found" });
    const repo = access.channel.github && access.channel.github.repo;
    if (!repo) return res.status(404).json({ success: false, message: "No repository linked" });

    const [info, commits, pulls, issues] = await Promise.all([
      ghFetch(`/repos/${repo}`),
      ghFetch(`/repos/${repo}/commits?per_page=6`),
      ghFetch(`/repos/${repo}/pulls?state=open&per_page=6`),
      ghFetch(`/repos/${repo}/issues?state=open&per_page=12`),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        repo,
        url: info.html_url,
        description: info.description,
        stars: info.stargazers_count,
        forks: info.forks_count,
        openIssues: info.open_issues_count,
        language: info.language,
        defaultBranch: info.default_branch,
        commits: commits.map((c) => ({
          sha: c.sha.slice(0, 7),
          message: firstLine(c.commit.message),
          author: (c.author && c.author.login) || c.commit.author.name,
          url: c.html_url,
          date: c.commit.author.date,
        })),
        pulls: pulls.map((p) => ({ number: p.number, title: p.title, user: p.user.login, url: p.html_url, draft: p.draft })),
        issues: issues
          .filter((i) => !i.pull_request)
          .slice(0, 6)
          .map((i) => ({ number: i.number, title: i.title, user: i.user.login, url: i.html_url })),
      },
    });
  } catch (error) {
    if (error.status || error.name === "TimeoutError" || error.name === "TypeError") {
      const [code, message] = ghError(error);
      return res.status(code).json({ success: false, message });
    }
    return fail(res, error);
  }
};

const webhookUrl = (req, channelId) =>
  `${process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`}/webhooks/github/${channelId}`;

// PUT /channels/:id/github  { repo }   (members/admin, not guests)
const linkRepo = async (req, res) => {
  try {
    const access = await getChannelForMember(req.params.id, req.user.id);
    if (!access) return res.status(404).json({ success: false, message: "Channel not found" });
    if (access.role === "guest") {
      return res.status(403).json({ success: false, message: "Guests cannot link repositories" });
    }
    const repo = parseRepo(req.body.repo);
    if (!repo) {
      return res.status(400).json({ success: false, message: "Enter a repo like owner/name or a GitHub URL" });
    }
    try {
      await ghFetch(`/repos/${repo}`);
    } catch (e) {
      if (e.status === 404) {
        const [code, message] = ghError(e);
        return res.status(code).json({ success: false, message });
      } // other errors (rate limit, offline): still allow linking
    }
    const secret = crypto.randomBytes(20).toString("hex");
    access.channel.github = { repo, webhookSecret: secret, linkedBy: req.user.id };
    await access.channel.save();

    const conv = { kind: "channel", doc: access.channel, workspace: access.workspace,
      recipients: (access.channel.isDefault ? access.workspace.member : access.channel.members).map(String) };
    await createMessage({
      io: req.app.get("io"),
      conv,
      type: "github",
      text: `Linked this channel to ${repo}`,
      meta: { event: "linked", repo, url: `https://github.com/${repo}` },
    });
    req.app.get("io")?.to(`workspace:${access.workspace._id}`).emit("channel:updated", {
      _id: String(access.channel._id), github: { repo },
    });
    return res.status(200).json({
      success: true,
      data: { repo },
      webhook: { url: webhookUrl(req, access.channel._id), secret },
    });
  } catch (error) {
    return fail(res, error);
  }
};

const unlinkRepo = async (req, res) => {
  try {
    const access = await getChannelForMember(req.params.id, req.user.id);
    if (!access) return res.status(404).json({ success: false, message: "Channel not found" });
    if (access.role === "guest") {
      return res.status(403).json({ success: false, message: "Guests cannot change this" });
    }
    access.channel.github = undefined;
    await access.channel.save();
    req.app.get("io")?.to(`workspace:${access.workspace._id}`).emit("channel:updated", {
      _id: String(access.channel._id), github: null,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return fail(res, error);
  }
};

// GET /channels/:id/github/webhook  -> setup details (admin or the person who linked it)
const getWebhookInfo = async (req, res) => {
  try {
    const access = await getChannelForMember(req.params.id, req.user.id);
    const gh = access && access.channel.github;
    if (!gh || !gh.repo) return res.status(404).json({ success: false, message: "No repository linked" });
    if (access.role !== "admin" && !same(gh.linkedBy, req.user.id)) {
      return res.status(403).json({ success: false, message: "Only the admin or whoever linked the repo can see this" });
    }
    return res.status(200).json({
      success: true,
      webhook: { url: webhookUrl(req, access.channel._id), secret: gh.webhookSecret },
    });
  } catch (error) {
    return fail(res, error);
  }
};

// ---- Incoming GitHub webhook: push / pull_request / issues / issue_comment -> bot message in the channel ----
const describeEvent = (event, p) => {
  const actor = (p.sender && p.sender.login) || "someone";
  if (event === "push") {
    const branch = String(p.ref || "").replace("refs/heads/", "");
    const n = (p.commits || []).length;
    if (p.deleted) return { text: `${actor} deleted branch ${branch}`, url: p.repository.html_url };
    if (!n) return null;
    return {
      text: `${actor} pushed ${n} commit${n > 1 ? "s" : ""} to ${branch}: ${firstLine(p.head_commit && p.head_commit.message)}`,
      url: p.compare || (p.head_commit && p.head_commit.url),
    };
  }
  if (event === "pull_request") {
    const pr = p.pull_request;
    if (!["opened", "closed", "reopened", "ready_for_review"].includes(p.action)) return null;
    const verb = p.action === "closed" && pr.merged ? "merged" : p.action.replace("_", " ");
    return { text: `${actor} ${verb} PR #${pr.number}: ${pr.title}`, url: pr.html_url };
  }
  if (event === "issues") {
    if (!["opened", "closed", "reopened"].includes(p.action)) return null;
    return { text: `${actor} ${p.action} issue #${p.issue.number}: ${p.issue.title}`, url: p.issue.html_url };
  }
  if (event === "issue_comment" && p.action === "created") {
    return { text: `${actor} commented on #${p.issue.number}: ${firstLine(p.comment.body)}`, url: p.comment.html_url };
  }
  return null;
};

const webhook = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.channelId)) return res.sendStatus(404);
    const channel = await Channel.findById(req.params.channelId);
    const gh = channel && channel.github;
    if (!gh || !gh.repo || !gh.webhookSecret) return res.sendStatus(404);

    const sig = String(req.get("x-hub-signature-256") || "");
    const expected = "sha256=" + crypto.createHmac("sha256", gh.webhookSecret).update(req.rawBody || "").digest("hex");
    const ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return res.status(401).json({ success: false, message: "Bad signature" });

    const event = req.get("x-github-event");
    if (event === "ping") return res.status(200).json({ success: true, message: "pong" });
    const d = describeEvent(event, req.body || {});
    if (!d) return res.status(202).json({ success: true, message: "Ignored" });

    const workspace = await Workspace.findById(channel.workspace);
    if (!workspace) return res.sendStatus(404);
    const conv = { kind: "channel", doc: channel, workspace,
      recipients: (channel.isDefault ? workspace.member : channel.members).map(String) };
    await createMessage({
      io: req.app.get("io"),
      conv,
      type: "github",
      text: d.text.slice(0, 500),
      meta: { event, repo: gh.repo, url: d.url },
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return fail(res, error);
  }
};

module.exports = { getGithubInfo, linkRepo, unlinkRepo, getWebhookInfo, webhook, parseRepo };
