// Name shown for a direct message: everyone except me
export const dmLabel = (dm, meId) => {
    const others = (dm.participants || []).filter((p) => String(p._id) !== String(meId))
    return others.length ? others.map((p) => p.name).join(", ") : "Just you"
}
export const convKey = (kind, id) => `${kind}:${id}`
