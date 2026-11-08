export default function StatPill({ label, value, dotColor = '#8B9DFF' }) {
    return (
        <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-white/50">
                <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: dotColor }}
                />
                {label}
            </span>
            <div className="mt-1 text-base font-bold text-white">{value}</div>
        </div>
    );
}
