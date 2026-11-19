import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useAnalyticsTimezone } from '@/Pages/Pomodoro/useAnalyticsTimezone';
import WorkoutStatsView from './StatsView';

export default function Stats({ analytics, records = [] }) {
    // Same correction the Pomodoro analytics pages make, and for the same
    // reason: a plain navigation carries no timezone, so an evening workout
    // would be bucketed on the wrong day until the page says where it is.
    useAnalyticsTimezone(analytics.timezone, ['analytics', 'records']);

    return <WorkoutStatsView analytics={analytics} records={records} />;
}

Stats.layout = (page) => (
    <AuthenticatedLayout module="workout">{page}</AuthenticatedLayout>
);
