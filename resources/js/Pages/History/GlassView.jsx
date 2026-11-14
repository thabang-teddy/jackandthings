import GlassCard from '@/Components/Glass/GlassCard';
import GlassPagination from '@/Components/Glass/GlassPagination';
import TxRow from '@/Components/Glass/TxRow';
import { HistoryIcon } from '@/Components/Glass/icons';
import { formatWhen } from '@/Lib/formatWhen';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
} from '@/Components/Glass/GlassFormControls';

export default function HistoryGlassView({
    entries,
    retentionDays,
    formState,
    onSubmit,
    onDestroy,
}) {
    const { data, setData, errors, processing } = formState;

    return (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
                <GlassCard id="browsing" title="Add a visit">
                    <form
                        onSubmit={onSubmit}
                        className="grid gap-3 sm:grid-cols-2"
                    >
                        <div>
                            <GlassLabel htmlFor="glass_history_url">
                                URL
                            </GlassLabel>
                            <GlassInput
                                id="glass_history_url"
                                type="url"
                                value={data.url}
                                onChange={(e) => setData('url', e.target.value)}
                                placeholder="https://example.com/page"
                                required
                            />
                            <GlassError message={errors.url} />
                        </div>
                        <div>
                            <GlassLabel htmlFor="glass_history_title">
                                Title (optional)
                            </GlassLabel>
                            <GlassInput
                                id="glass_history_title"
                                value={data.title}
                                onChange={(e) =>
                                    setData('title', e.target.value)
                                }
                            />
                            <GlassError message={errors.title} />
                        </div>
                        <div className="sm:col-span-2">
                            <GlassButton type="submit" disabled={processing}>
                                Add entry
                            </GlassButton>
                        </div>
                    </form>
                </GlassCard>

                <GlassCard
                    title="Browsing"
                    className="min-h-0 flex-1 overflow-y-auto"
                >
                    {entries.data.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">
                            Add one above, or wait for the browser add-on to
                            report visits.
                        </p>
                    ) : (
                        entries.data.map((entry) => (
                            <TxRow
                                key={entry.id}
                                icon={<HistoryIcon size={14} />}
                                iconColor="#5F6B5F"
                                title={entry.title || entry.url}
                                subtitle={
                                    formatWhen(entry.visited_at) +
                                    (entry.source ? ` · ${entry.source}` : '')
                                }
                                action={
                                    <button
                                        type="button"
                                        onClick={() => onDestroy(entry)}
                                        className="ml-2 shrink-0 text-xs text-[var(--muted)] hover:text-[var(--neg)]"
                                    >
                                        Delete
                                    </button>
                                }
                            />
                        ))
                    )}
                </GlassCard>

                <GlassPagination links={entries.links} />
            </div>

            <GlassCard id="retention" title="Retention">
                <p className="text-sm text-[var(--ink)]">
                    Entries older than{' '}
                    <strong className="font-bold text-[var(--ink)]">
                        {retentionDays} days
                    </strong>{' '}
                    are deleted automatically by the nightly prune job.
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                    That window is a placeholder default, not a confirmed rule —
                    the real auto-delete policy is still an open decision. Until
                    the browser add-on exists, entries are added here by hand.
                </p>
            </GlassCard>
        </div>
    );
}
