/**
 * @param {{ title: string, description?: string, children?: import('react').ReactNode }} props
 */
export default function EmptyState({ title, description, children }) {
    return (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center dark:border-gray-600">
            <p className="font-medium text-gray-900 dark:text-gray-100">
                {title}
            </p>
            {description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {description}
                </p>
            )}
            {children && <div className="mt-4">{children}</div>}
        </div>
    );
}
