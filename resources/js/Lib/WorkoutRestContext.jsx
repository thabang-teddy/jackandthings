import { createContext, useContext } from 'react';
import { useRestTimer } from '@/Lib/useRestTimer';

const WorkoutRestContext = createContext(null);

/**
 * Mounts a single `useRestTimer()` above every authenticated page (see
 * AuthenticatedLayout), for the same reason PomodoroTimerProvider does: the
 * countdown has to keep running while Inertia swaps the page out from under
 * it. Without this, walking from Today to Sessions mid-workout would restart
 * the rest timer from localStorage, or lose it.
 */
export function WorkoutRestProvider({ children }) {
    const rest = useRestTimer();

    return (
        <WorkoutRestContext.Provider value={rest}>
            {children}
        </WorkoutRestContext.Provider>
    );
}

export function useWorkoutRest() {
    const rest = useContext(WorkoutRestContext);

    if (!rest) {
        throw new Error(
            'useWorkoutRest must be used within a WorkoutRestProvider',
        );
    }

    return rest;
}
