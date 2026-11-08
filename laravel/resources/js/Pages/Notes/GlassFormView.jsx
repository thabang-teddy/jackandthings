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
    isEdit,
    data,
    setData,
    errors,
    processing,
    onSubmit,
}) {
    return (
        <GlassCard
            title={isEdit ? 'Edit note' : 'New note'}
            className="max-w-xl"
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
                    <Link
                        href={route('notes.index')}
                        className="text-sm text-white/40 hover:text-white"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </GlassCard>
    );
}
