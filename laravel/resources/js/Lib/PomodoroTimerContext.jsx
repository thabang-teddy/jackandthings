import { createContext, useContext } from 'react';
import { usePomodoroLiveLink } from '@/Lib/usePomodoroLiveLink';

const PomodoroTimerContext = createContext(null);

/**
 * Mounts a single `useCountdown()` instance above every authenticated page
 * (see AuthenticatedLayout) so the timer keeps ticking as Inertia swaps the
 * page out from under it, rather than each page restoring its own copy from
 * localStorage. That is what lets a timer started on the home page still be
 * running on the Pomodoro page, and back again.
 *
 * The timer is wrapped with `usePomodoroLiveLink`, so starting or stopping
 * here posts the state to the server's live link and the phone (and any other
 * tab) can adopt it - and vice versa.
 */
export function PomodoroTimerProvider({ children }) {
    const timer = usePomodoroLiveLink();
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
