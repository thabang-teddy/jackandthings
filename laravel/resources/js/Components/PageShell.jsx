import { Head } from '@inertiajs/react';

/**
 * Shared page chrome for every module page: title, optional action slot, and a
 * card-width container. Keeps module pages from repeating the same wrappers.
 *
 * @param {{ title: string, action?: import('react').ReactNode, children: import('react').ReactNode }} props
 */
export default function PageShell({ title, action, children }) {
    return (
        <>
            <Head title={title} />

            <div className="py-10">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                            {title}
                        </h1>
                        {action}
                    </div>

                    {children}
                </div>
            </div>
        </>
    );
}
