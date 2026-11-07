/**
 * Tiny DOM helpers.
 *
 * Everything is built as nodes with textContent rather than assembled HTML
 * strings: notes, snippets and page titles all come from the server or the
 * browser, and none of it should ever be parsed as markup.
 */

export function h(tag, props = {}, children = []) {
    const node = document.createElement(tag);

    for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined || value === false) continue;

        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'html') throw new Error('h(): raw HTML is not allowed');
        else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'value') node.value = value;
        else if (value === true) node.setAttribute(key, '');
        else node.setAttribute(key, value);
    }

    for (const child of [].concat(children)) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }

    return node;
}

export function clear(node) {
    node.replaceChildren();
    return node;
}

export const alert = (message) => h('div', { class: 'alert', text: message });
export const notice = (message) => h('div', { class: 'notice', text: message });
export const muted = (message) => h('p', { class: 'muted', text: message });

/** Runs an async action, showing failures in place instead of throwing away. */
export async function guard(container, action) {
    try {
        await action();
    } catch (error) {
        container.prepend(alert(error?.message ?? 'Something went wrong.'));
    }
}
