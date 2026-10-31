const Channel = require("../models/channel");
const Workspace = require("../models/workspaces");

// Upgrades channels created by the first version of the app
// (they had no `members` / `isDefault` fields).
module.exports = async () => {
  try {
    await Channel.updateMany({ name: "general", isDefault: { $exists: false } }, { $set: { isDefault: true } });
    const stale = await Channel.find({ members: { $exists: false } });
    for (const ch of stale) {
      const ws = await Workspace.findById(ch.workspace);
      ch.members = ws ? ws.member : [];
      await ch.save();
    }
    if (stale.length) console.log(`Migrated ${stale.length} channel(s)`);
  } catch (e) {
    console.log("Migration skipped:", e.message);
  }
};
