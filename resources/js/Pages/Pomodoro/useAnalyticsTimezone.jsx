import { useEffect } from 'react';
import { router } from '@inertiajs/react';
import { currentTimezone } from '@/Lib/pomodoroSessionLog';

/**
 * Re-asks the server for its time-bucketed props in this browser's own zone.
 *
 * The server runs in UTC and buckets in whatever zone the request names. The
 * first render of any of these pages comes from a plain navigation, which
 * carries no zone — so an evening session would show up on yesterday until
 * the page says where it is. This asks once, and only when the zone the
 * server used is not the one we are in.
 *
 * `props` is the subset to re-fetch, so the Timer page does not pull the
 * whole analytics payload to correct one total.
 */
export function useAnalyticsTimezone(serverTimezone, props) {
    useEffect(() => {
        const zone = currentTimezone();
        if (!zone || serverTimezone === zone) {
            return;
        }

        router.reload({
            only: props,
            data: { tz: zone },
            preserveScroll: true,
            preserveState: true,
        });
        // `props` is a literal at every call site; depending on it would
        // re-run this on every render for a new array identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverTimezone]);
}
