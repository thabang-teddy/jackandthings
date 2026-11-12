import GlassCard from '@/Components/Glass/GlassCard';
import GlassPagination from '@/Components/Glass/GlassPagination';
import TxRow from '@/Components/Glass/TxRow';
import {
    DocumentIcon,
    StarIcon,
    StarOutlineIcon,
} from '@/Components/Glass/icons';
import { formatWhen } from '@/Lib/formatWhen';

export default function NotesGlassIndexView({
    notes,
    editingId,
    onEdit,
    onDestroy,
    onToggleStar,
}) {
    return (
        <div id="notes" className="flex h-full min-h-0 flex-col gap-4">
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
                                    : '') +
                                `Updated ${formatWhen(note.updated_at)}`
                            }
                            action={
                                <div className="ml-2 flex shrink-0 items-center gap-3 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => onToggleStar(note)}
                                        aria-pressed={note.is_starred}
                                        title={
                                            note.is_starred
                                                ? 'Starred (shows on the home page)'
                                                : 'Star to pin to the home page'
                                        }
                                        className={
                                            note.is_starred
                                                ? 'text-[var(--accent)]'
                                                : 'text-[var(--muted)] hover:text-[var(--ink)]'
                                        }
                                    >
                                        {note.is_starred ? (
                                            <StarIcon size={14} />
                                        ) : (
                                            <StarOutlineIcon size={14} />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onEdit(note)}
                                        className={
                                            'hover:underline ' +
                                            (editingId === note.id
                                                ? 'font-bold text-[var(--accent)]'
                                                : 'text-[#8BB4FF]')
                                        }
                                    >
                                        Edit
                                    </button>
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
