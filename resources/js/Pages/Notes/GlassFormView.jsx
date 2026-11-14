import GlassCard from '@/Components/Glass/GlassCard';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassTextarea,
} from '@/Components/Glass/GlassFormControls';
import { Link } from '@inertiajs/react';

export default function NotesGlassFormView({
    id,
    isEdit,
    data,
    setData,
    errors,
    processing,
    onSubmit,
    onCancel,
    className = 'max-w-xl',
}) {
    return (
        <GlassCard
            id={id}
            title={isEdit ? 'Edit note' : 'New note'}
            className={className}
        >
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <GlassLabel htmlFor="glass_note_title">Title</GlassLabel>
                    <GlassInput
                        id="glass_note_title"
                        value={data.title}
                        onChange={(e) => setData('title', e.target.value)}
                        required
                    />
                    <GlassError message={errors.title} />
                </div>
                <div>
                    <GlassLabel htmlFor="glass_note_body">Body</GlassLabel>
                    <GlassTextarea
                        id="glass_note_body"
                        rows={10}
                        value={data.body}
                        onChange={(e) => setData('body', e.target.value)}
                    />
                    <GlassError message={errors.body} />
                </div>
                <div className="flex items-center gap-4">
                    <GlassButton type="submit" disabled={processing}>
                        {isEdit ? 'Save changes' : 'Create note'}
                    </GlassButton>
                    {onCancel ? (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                            {isEdit ? 'Cancel' : 'Clear'}
                        </button>
                    ) : (
                        <Link
                            href={route('notes.index')}
                            className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                            Cancel
                        </Link>
                    )}
                </div>
            </form>
        </GlassCard>
    );
}
