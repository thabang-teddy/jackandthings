import { useEffect, useState } from 'react';

function formatTime(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Live HH:MM:SS clock, ticking every second. Purely client-side — nothing
 * here round-trips to the server.
 */
export default function LiveClock({ className = '' }) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <p className={`font-mono font-bold tabular-nums ${className}`}>
            {formatTime(now)}
        </p>
    );
}
