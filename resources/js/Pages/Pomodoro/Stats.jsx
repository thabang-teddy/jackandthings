import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AnalyticsCard from './AnalyticsCard';
import { useAnalyticsTimezone } from './useAnalyticsTimezone';

/**
 * The Stats page: the daily and weekly figures issue #3 asks for.
 *
 * Every number comes from App\Services\PomodoroAnalytics, already bucketed in
 * this browser's timezone — the hook below is what tells the server which
 * zone that is, since a plain navigation carries none and UTC would put an
 * evening session on yesterday.
 */
export default function Stats({ analytics }) {
    useAnalyticsTimezone(analytics.timezone, ['analytics']);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <AnalyticsCard analytics={analytics} />
        </div>
    );
}

Stats.layout = (page) => (
    <AuthenticatedLayout module="pomodoro">{page}</AuthenticatedLayout>
);
