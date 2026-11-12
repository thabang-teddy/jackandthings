import { createContext, useContext } from 'react';
import { useCountdown } from '@/Lib/useCountdown';

const PomodoroTimerContext = createContext(null);

/**
 * Mounts a single `useCountdown()` instance above every authenticated page
 * (see AuthenticatedLayout) so the timer keeps ticking as Inertia swaps the
 * page out from under it, rather than each page restoring its own copy from
 * localStorage. That is what lets a timer started on the home page still be
 * running on the Pomodoro page, and back again.
 */
export function PomodoroTimerProvider({ children }) {
    const timer = useCountdown();
    return (
        <PomodoroTimerContext.Provider value={timer}>
            {children}
        </PomodoroTimerContext.Provider>
    );
}

export function usePomodoroTimer() {
    const timer = useContext(PomodoroTimerContext);
    if (!timer) {
        throw new Error(
            'usePomodoroTimer must be used within a PomodoroTimerProvider',
        );
    }
    return timer;
}
