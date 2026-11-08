import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { getSubmenuForSecondaryPage } from '@/Lib/glassNav';
import ClipboardGlassFormView from './GlassFormView';
import { useForm } from '@inertiajs/react';

export default function Form({ item }) {
    const isEdit = Boolean(item);

    const { data, setData, post, put, processing, errors } = useForm({
        title: item?.title ?? '',
        content: item?.content ?? '',
    });

    const submit = (event) => {
        event.preventDefault();

        if (isEdit) {
            put(route('clipboard.update', item.id));
        } else {
            post(route('clipboard.store'));
        }
    };

    return (
        <ClipboardGlassFormView
            isEdit={isEdit}
            data={data}
            setData={setData}
            errors={errors}
            processing={processing}
            onSubmit={submit}
        />
    );
}

Form.layout = (page) => (
    <AuthenticatedLayout
        module="clipboard"
        submenu={getSubmenuForSecondaryPage('clipboard', 'clipboard.index')}
    >
        {page}
    </AuthenticatedLayout>
);
