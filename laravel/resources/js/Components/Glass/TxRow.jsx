export default function TxRow({
    icon,
    iconColor = '#2B6CFF',
    title,
    subtitle,
    trailing,
    trailingTone,
    action,
}) {
    const trailingClass =
        trailingTone === 'pos'
            ? 'text-emerald-400'
            : trailingTone === 'neg'
              ? 'text-rose-400'
              : 'text-white/70';

    return (
        <div className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-b-0">
            {icon && (
                <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: iconColor }}
                >
                    {icon}
                </div>
            )}
            <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-white">
                    {title}
                </div>
                {subtitle && (
                    <div className="truncate text-[10.5px] text-white/40">
                        {subtitle}
                    </div>
                )}
            </div>
            {trailing && (
                <div
                    className={`shrink-0 text-[12.5px] font-bold ${trailingClass}`}
                >
                    {trailing}
                </div>
            )}
            {action}
        </div>
    );
}
