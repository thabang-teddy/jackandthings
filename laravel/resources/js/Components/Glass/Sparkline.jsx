/**
 * Minimal area/line sparkline. Takes real numeric `values` (already computed
 * by the caller from real data — this component does no data derivation of
 * its own) and plots them across a fixed viewBox.
 */
export default function Sparkline({
    values,
    color = '#2B6CFF',
    height = 48,
    area = true,
}) {
    const width = 220;

    if (!values || values.length < 2) {
        return (
            <div
                style={{ height }}
                className="flex items-center text-[11px] text-white/35"
            >
                Not enough data yet
            </div>
        );
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    const points = values.map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - ((value - min) / span) * height;
        return [x, y];
    });

    const linePath = points
        .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`)
        .join(' ');

    const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
    const gradientId = `spark-${color.replace('#', '')}`;

    return (
        <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
        >
            {area && (
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop
                            offset="0%"
                            stopColor={color}
                            stopOpacity="0.45"
                        />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
            )}
            {area && <path d={areaPath} fill={`url(#${gradientId})`} />}
            <path d={linePath} fill="none" stroke={color} strokeWidth="2" />
        </svg>
    );
}
