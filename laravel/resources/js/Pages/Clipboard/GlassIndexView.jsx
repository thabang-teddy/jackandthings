import GlassCard from '@/Components/Glass/GlassCard';
import GlassPagination from '@/Components/Glass/GlassPagination';
import PillButton from '@/Components/Glass/PillButton';
import TxRow from '@/Components/Glass/TxRow';
import { CopyIcon } from '@/Components/Glass/icons';
import { Link } from '@inertiajs/react';

export default function ClipboardGlassIndexView({
    items,
    copiedId,
    onCopy,
    onDestroy,
}) {
    return (
        <div id="recent" className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex items-center justify-between">
                <p className="max-w-md text-xs text-white/40">
                    Snippets saved here are available to this account. Syncing
                    with the Android app and browser add-ons arrives when those
                    clients are built.
                </p>
                <PillButton href={route('clipboard.create')} primary>
                    + New snippet
                </PillButton>
            </div>

            <GlassCard className="min-h-0 flex-1 overflow-y-auto">
                {items.data.length === 0 ? (
                    <p className="py-8 text-center text-sm text-white/50">
                        Nothing saved yet.
                    </p>
                ) : (
                    items.data.map((item) => (
                        <TxRow
                            key={item.id}
                            icon={<CopyIcon size={14} />}
                            iconColor="#BA7517"
                            title={item.title || item.content.slice(0, 48)}
                            subtitle={
                                item.created_at +
                                (item.source_device
                                    ? ` · from ${item.source_device}`
                                    : '')
                            }
                            action={
                                <div className="ml-2 flex shrink-0 items-center gap-3 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => onCopy(item)}
                                        className="text-[#8BB4FF] hover:underline"
                                    >
                                        {copiedId === item.id
                                            ? 'Copied'
                                            : 'Copy'}
                                    </button>
                                    <Link
                                        href={route('clipboard.edit', item.id)}
                                        className="text-white/50 hover:underline"
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => onDestroy(item)}
                                        className="text-white/30 hover:text-rose-400"
                                    >
                                        Delete
                                    </button>
                                </div>
                            }
                        />
                    ))
                )}
            </GlassCard>

            <GlassPagination links={items.links} />
        </div>
    );
}
