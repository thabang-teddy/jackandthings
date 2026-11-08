import GlassCard from '@/Components/Glass/GlassCard';
import GlassPagination from '@/Components/Glass/GlassPagination';
import PillButton from '@/Components/Glass/PillButton';
import TxRow from '@/Components/Glass/TxRow';
import { DocumentIcon } from '@/Components/Glass/icons';
import { Link } from '@inertiajs/react';

export default function NotesGlassIndexView({ notes, onDestroy }) {
    return (
        <div id="notes" className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--muted)]">
                    {notes.data.length} note{notes.data.length === 1 ? '' : 's'}
                </p>
                <PillButton href={route('notes.create')} primary>
                    + New note
                </PillButton>
            </div>

            <GlassCard className="min-h-0 flex-1 overflow-y-auto">
                {notes.data.length === 0 ? (
                    <div className="py-8 text-center">
                        <p className="text-sm text-[var(--muted)]">
                            No notes yet.
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                            Anything you jot down here stays private to your
                            account.
                        </p>
                    </div>
                ) : (
                    notes.data.map((note) => (
                        <TxRow
                            key={note.id}
                            icon={<DocumentIcon size={14} />}
                            iconColor="#2B6CFF"
                            title={note.title}
                            subtitle={
                                (note.body
                                    ? `${note.body.slice(0, 80)} · `
                                    : '') + `Updated ${note.updated_at}`
                            }
                            action={
                                <div className="ml-2 flex shrink-0 items-center gap-3 text-xs">
                                    <Link
                                        href={route('notes.edit', note.id)}
                                        className="text-[#8BB4FF] hover:underline"
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => onDestroy(note)}
                                        className="text-[var(--muted)] hover:text-[var(--neg)]"
                                    >
                                        Delete
                                    </button>
                                </div>
                            }
                        />
                    ))
                )}
            </GlassCard>

            <GlassPagination links={notes.links} />
        </div>
    );
}
