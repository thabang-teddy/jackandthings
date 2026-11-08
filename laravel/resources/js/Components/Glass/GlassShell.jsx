import { Head, usePage } from '@inertiajs/react';
import Dropdown from '@/Components/Dropdown';
import Rail from '@/Components/Glass/Rail';
import SubmenuPills from '@/Components/Glass/SubmenuPills';
import ThemeToggle from '@/Components/Glass/ThemeToggle';
import { BellIcon } from '@/Components/Glass/icons';
import { getModule, getSubmenu } from '@/Lib/glassNav';

export default function GlassShell({
    module,
    title,
    submenu,
    activeAnchor,
    children,
}) {
    const { auth, flash } = usePage().props;
    const moduleInfo = getModule(module);
    const items = submenu ?? getSubmenu(module);
    const initials = (auth.user.name || '?')
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#0A0F1E] text-[#EAF0FF]">
            <Head title={title ?? moduleInfo?.label ?? 'Jack & Things'} />

            <div
                className="pointer-events-none absolute h-[420px] w-[420px] rounded-full opacity-35 blur-[70px]"
                style={{ background: '#2B6CFF', top: '-140px', left: '260px' }}
            />
            <div
                className="pointer-events-none absolute h-[380px] w-[380px] rounded-full opacity-35 blur-[70px]"
                style={{
                    background: '#17D9D4',
                    bottom: '-160px',
                    right: '-100px',
                }}
            />

            <div className="relative z-10 flex min-h-screen gap-4 p-6">
                <Rail active={module} />

                <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className="flex items-center gap-3">
                        {(title || moduleInfo) && (
                            <h1 className="text-lg font-bold">
                                {title ?? moduleInfo.label}
                            </h1>
                        )}
                        <div className="ml-auto flex items-center gap-2.5">
                            {items.length > 0 && (
                                <SubmenuPills
                                    items={items}
                                    activeAnchor={activeAnchor}
                                />
                            )}
                            <ThemeToggle />
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
                                <BellIcon size={15} />
                            </div>
                            <Dropdown>
                                <Dropdown.Trigger>
                                    <button
                                        type="button"
                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2B6CFF] text-[11px] font-bold text-[#06121A]"
                                    >
                                        {initials || 'U'}
                                    </button>
                                </Dropdown.Trigger>
                                <Dropdown.Content>
                                    <Dropdown.Link href={route('profile.edit')}>
                                        Profile
                                    </Dropdown.Link>
                                    <Dropdown.Link
                                        href={route('logout')}
                                        method="post"
                                        as="button"
                                    >
                                        Log Out
                                    </Dropdown.Link>
                                </Dropdown.Content>
                            </Dropdown>
                        </div>
                    </div>

                    {flash?.status && (
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
                            {flash.status}
                        </div>
                    )}

                    <div className="min-h-0 flex-1">{children}</div>
                </div>
            </div>
        </div>
    );
}
