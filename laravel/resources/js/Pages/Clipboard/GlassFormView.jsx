import GlassCard from '@/Components/Glass/GlassCard';
import {
    GlassButton,
    GlassError,
    GlassInput,
    GlassLabel,
    GlassTextarea,
} from '@/Components/Glass/GlassFormControls';
import { Link } from '@inertiajs/react';

export default function ClipboardGlassFormView({
    isEdit,
    data,
    setData,
    errors,
    processing,
    onSubmit,
}) {
    return (
        <GlassCard
            title={isEdit ? 'Edit snippet' : 'New snippet'}
            className="max-w-xl"
        >
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <GlassLabel htmlFor="glass_clip_title">
                        Title (optional)
                    </GlassLabel>
                    <GlassInput
                        id="glass_clip_title"
                        value={data.title}
                        onChange={(e) => setData('title', e.target.value)}
                    />
                    <GlassError message={errors.title} />
                </div>
                <div>
                    <GlassLabel htmlFor="glass_clip_content">
                        Content
                    </GlassLabel>
                    <GlassTextarea
                        id="glass_clip_content"
                        rows={8}
                        required
                        className="font-mono"
                        value={data.content}
                        onChange={(e) => setData('content', e.target.value)}
                    />
                    <GlassError message={errors.content} />
                </div>
                <div className="flex items-center gap-4">
                    <GlassButton type="submit" disabled={processing}>
                        {isEdit ? 'Save changes' : 'Save snippet'}
                    </GlassButton>
                    <Link
                        href={route('clipboard.index')}
                        className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </GlassCard>
    );
}
