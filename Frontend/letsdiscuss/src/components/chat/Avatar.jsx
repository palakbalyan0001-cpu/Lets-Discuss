const COLORS = ["bg-emerald-200 text-emerald-900", "bg-sky-200 text-sky-900", "bg-amber-200 text-amber-900", "bg-rose-200 text-rose-900", "bg-violet-200 text-violet-900"]
export default function Avatar({ name = "?", size = "h-9 w-9" }) {
    const color = COLORS[(name.charCodeAt(0) || 0) % COLORS.length]
    return (
        <div className={`${size} ${color} rounded-lg font-bold flex items-center justify-center shrink-0`}>
            {name[0]?.toUpperCase() || "?"}
        </div>
    )
}
