import { useCallback, useEffect, useState } from 'react';

/**
 * Toggles the Fullscreen API on a given element ref, for a distraction-free
 * view (e.g. the Pomodoro Overview card). Tracks `fullscreenchange` so the
 * toggle button stays correct if the user exits with Esc instead of a click.
 */
export function useFullscreen(elementRef) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleChange = () => {
            setIsFullscreen(document.fullscreenElement === elementRef.current);
        };

        document.addEventListener('fullscreenchange', handleChange);
        return () =>
            document.removeEventListener('fullscreenchange', handleChange);
    }, [elementRef]);

    const toggle = useCallback(() => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
            return;
        }

        elementRef.current?.requestFullscreen?.();
    }, [elementRef]);

    return { isFullscreen, toggle };
}
