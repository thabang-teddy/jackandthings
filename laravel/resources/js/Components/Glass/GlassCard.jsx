/**
 * Translucent card surface used throughout the glass theme. Pass `id` so a
 * SubmenuPills "anchor" item can scroll to it.
 */
export default function GlassCard({
    id,
    title,
    action,
    className = '',
    children,
}) {
    return (
        <div
            id={id}
            className={
                'rounded-[22px] border border-white/10 bg-white/5 p-5 ' +
                className
            }
        >
            {(title || action) && (
                <div className="mb-3 flex items-center justify-between gap-3">
                    {title && (
                        <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-white/45">
                            {title}
                        </h4>
                    )}
                    {action}
                </div>
            )}
            {children}
        </div>
    );
}
