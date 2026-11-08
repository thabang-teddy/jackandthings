import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import WatchListGlassView from './GlassView';
import { router, useForm } from '@inertiajs/react';
import { useState } from 'react';

export default function Index({ lists }) {
    const [selectedId, setSelectedId] = useState(lists[0]?.id ?? null);

    const listForm = useForm({ name: '' });
    const itemForm = useForm({
        watch_list_id: lists[0]?.id ?? '',
        title: '',
        note: '',
    });

    const selected = lists.find((list) => list.id === selectedId) ?? null;

    const select = (id) => {
        setSelectedId(id);
        itemForm.setData('watch_list_id', id);
        itemForm.clearErrors();
    };

    const createList = (event) => {
        event.preventDefault();

        const name = listForm.data.name;

        listForm.post(route('watchlist.store'), {
            preserveScroll: true,
            onSuccess: (page) => {
                listForm.reset();

                const created = (page.props.lists ?? []).find(
                    (list) => list.name === name,
                );

                if (created) {
                    select(created.id);
                }
            },
        });
    };

    const destroyList = (list) => {
        if (!window.confirm(`Delete "${list.name}" and its items?`)) {
            return;
        }

        router.delete(route('watchlist.destroy', list.id), {
            preserveScroll: true,
            onSuccess: (page) => {
                if (selectedId !== list.id) {
                    return;
                }

                const next = (page.props.lists ?? [])[0] ?? null;

                if (next) {
                    select(next.id);
                } else {
                    setSelectedId(null);
                    itemForm.setData('watch_list_id', '');
                }
            },
        });
    };

    const addItem = (event) => {
        event.preventDefault();

        if (!selected) {
            return;
        }

        itemForm.post(route('watchlist.items.store'), {
            preserveScroll: true,
            onSuccess: () => itemForm.reset('title', 'note'),
        });
    };

    const toggleItem = (item) => {
        router.put(
            route('watchlist.items.update', item.id),
            { done: !item.done },
            { preserveScroll: true },
        );
    };

    const destroyItem = (item) => {
        router.delete(route('watchlist.items.destroy', item.id), {
            preserveScroll: true,
        });
    };

    return (
        <WatchListGlassView
            lists={lists}
            selectedId={selectedId}
            onSelect={select}
            onCreateList={createList}
            onDestroyList={destroyList}
            listForm={listForm}
            itemForm={{
                data: itemForm.data,
                setData: itemForm.setData,
                errors: itemForm.errors,
                processing: itemForm.processing,
                onSubmit: addItem,
                onToggle: toggleItem,
                onDestroy: destroyItem,
            }}
        />
    );
}

Index.layout = (page) => (
    <AuthenticatedLayout module="watchlist">{page}</AuthenticatedLayout>
);
