import GlassCard from '@/Components/Glass/GlassCard';
import TxRow from '@/Components/Glass/TxRow';
import { CheckIcon, ListIcon } from '@/Components/Glass/icons';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
} from '@/Components/Glass/GlassFormControls';

/**
 * Two panes: the user's named lists on the left, the selected list's items
 * on the right. Items are toggled rather than edited in place — the only
 * writes are add, done and remove.
 */
export default function WatchListGlassView({
    lists,
    selectedId,
    onSelect,
    onCreateList,
    onDestroyList,
    listForm,
    itemForm,
}) {
    const selected = lists.find((list) => list.id === selectedId) ?? null;

    return (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard id="lists" title="Lists">
                <form onSubmit={onCreateList} className="grid gap-3">
                    <div>
                        <GlassLabel htmlFor="watchlist_name">
                            New list
                        </GlassLabel>
                        <GlassInput
                            id="watchlist_name"
                            value={listForm.data.name}
                            onChange={(event) =>
                                listForm.setData('name', event.target.value)
                            }
                            placeholder="Weekend watch list"
                            maxLength={60}
                            required
                        />
                        <GlassError message={listForm.errors.name} />
                    </div>
                    <GlassButton type="submit" disabled={listForm.processing}>
                        Create list
                    </GlassButton>
                </form>

                <div className="mt-4 flex flex-col gap-1">
                    {lists.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">
                            No lists yet. Create one above.
                        </p>
                    ) : (
                        lists.map((list) => (
                            <div
                                key={list.id}
                                className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                                style={
                                    list.id === selectedId
                                        ? { background: 'var(--card-bg)' }
                                        : undefined
                                }
                            >
                                <button
                                    type="button"
                                    onClick={() => onSelect(list.id)}
                                    className={
                                        'min-w-0 flex-1 truncate text-left text-sm ' +
                                        (list.id === selectedId
                                            ? 'font-bold text-[var(--ink)]'
                                            : 'text-[var(--muted)] hover:text-[var(--ink)]')
                                    }
                                >
                                    {list.name}
                                    <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                                        {list.items.length}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDestroyList(list)}
                                    className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--neg)]"
                                >
                                    Delete
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </GlassCard>

            <div className="flex flex-col gap-4 lg:col-span-2">
                <GlassCard
                    id="items"
                    title={selected ? selected.name : 'Items'}
                >
                    {selected ? (
                        <form
                            onSubmit={itemForm.onSubmit}
                            className="grid gap-3"
                        >
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <GlassLabel htmlFor="watchlist_item_title">
                                        Title
                                    </GlassLabel>
                                    <GlassInput
                                        id="watchlist_item_title"
                                        value={itemForm.data.title}
                                        onChange={(event) =>
                                            itemForm.setData(
                                                'title',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Dune: Part Two"
                                        maxLength={255}
                                        required
                                    />
                                    <GlassError
                                        message={itemForm.errors.title}
                                    />
                                </div>
                                <div>
                                    <GlassLabel htmlFor="watchlist_item_note">
                                        Note (optional)
                                    </GlassLabel>
                                    <GlassInput
                                        id="watchlist_item_note"
                                        value={itemForm.data.note}
                                        onChange={(event) =>
                                            itemForm.setData(
                                                'note',
                                                event.target.value,
                                            )
                                        }
                                        maxLength={1000}
                                    />
                                    <GlassError
                                        message={itemForm.errors.note}
                                    />
                                </div>
                            </div>
                            <div>
                                <GlassButton
                                    type="submit"
                                    disabled={itemForm.processing}
                                >
                                    Add item
                                </GlassButton>
                            </div>
                        </form>
                    ) : (
                        <p className="text-sm text-[var(--muted)]">
                            Choose a list, or create one, to add items.
                        </p>
                    )}
                </GlassCard>

                <GlassCard
                    title="To watch or read"
                    className="min-h-0 flex-1 overflow-y-auto"
                >
                    {!selected || selected.items.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">
                            Nothing on this list yet.
                        </p>
                    ) : (
                        selected.items.map((item) => (
                            <TxRow
                                key={item.id}
                                icon={<ListIcon size={14} />}
                                iconColor={item.done ? '#1D9E75' : '#BA7517'}
                                title={item.title}
                                subtitle={item.note || undefined}
                                action={
                                    <div className="ml-2 flex shrink-0 items-center gap-3 text-xs">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                itemForm.onToggle(item)
                                            }
                                            className={
                                                item.done
                                                    ? 'text-[var(--pos)] hover:underline'
                                                    : 'text-[#8BB4FF] hover:underline'
                                            }
                                        >
                                            {item.done ? (
                                                <span className="inline-flex items-center gap-1">
                                                    <CheckIcon size={12} /> Done
                                                </span>
                                            ) : (
                                                'Mark done'
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                itemForm.onDestroy(item)
                                            }
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
            </div>
        </div>
    );
}
