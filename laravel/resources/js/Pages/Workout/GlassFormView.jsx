import GlassCard from '@/Components/Glass/GlassCard';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassTextarea,
} from '@/Components/Glass/GlassFormControls';
import { Link } from '@inertiajs/react';

export default function WorkoutGlassFormView({
    isEdit,
    data,
    setData,
    errors,
    processing,
    onSubmit,
}) {
    return (
        <GlassCard
            title={isEdit ? 'Edit workout' : 'Log workout'}
            className="max-w-xl"
        >
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <GlassLabel htmlFor="glass_activity">Activity</GlassLabel>
                    <GlassInput
                        id="glass_activity"
                        value={data.activity}
                        onChange={(e) => setData('activity', e.target.value)}
                        placeholder="Push-ups, 5km run, gym session…"
                        required
                    />
                    <GlassError message={errors.activity} />
                </div>
                <div>
                    <GlassLabel htmlFor="glass_logged_at">
                        When (defaults to now)
                    </GlassLabel>
                    <GlassInput
                        id="glass_logged_at"
                        type="datetime-local"
                        value={data.logged_at}
                        onChange={(e) => setData('logged_at', e.target.value)}
                    />
                    <GlassError message={errors.logged_at} />
                </div>
                <div>
                    <GlassLabel htmlFor="glass_workout_notes">
                        Notes (optional)
                    </GlassLabel>
                    <GlassTextarea
                        id="glass_workout_notes"
                        rows={4}
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                    />
                    <GlassError message={errors.notes} />
                </div>
                <div className="flex items-center gap-4">
                    <GlassButton type="submit" disabled={processing}>
                        {isEdit ? 'Save changes' : 'Log it'}
                    </GlassButton>
                    <Link
                        href={route('workouts.index')}
                        className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </GlassCard>
    );
}
