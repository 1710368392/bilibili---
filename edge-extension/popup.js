const ICONS = {
    tag: '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
};

const STORAGE_KEY = 'bilibili_user_notes_v2';

function loadNotes() {
    return new Promise(resolve => {
        chrome.storage.local.get(STORAGE_KEY, result => resolve(result[STORAGE_KEY] || {}));
    });
}

function renderList(kw = '') {
    loadNotes().then(notes => {
        const list = document.getElementById('list');
        const all = Object.values(notes);
        const filtered = kw
            ? all.filter(n => n.name?.toLowerCase().includes(kw) || n.text?.toLowerCase().includes(kw) || n.tags?.some(t => t.text.toLowerCase().includes(kw)))
            : all;

        if (filtered.length === 0) {
            list.innerHTML = '<div class="empty">暂无备注</div>';
            return;
        }

        list.innerHTML = filtered.map(n => `
            <div class="item" data-uid="${n.uid}">
                <div class="info">
                    <div class="name">${n.name || '未设置名称'}</div>
                    <div class="uid">UID: ${n.uid}</div>
                </div>
                <div class="tags">
                    ${n.tags?.map(t => `<span class="tag" style="background:${t.color}">${t.text}</span>`).join('') || ''}
                    ${n.text ? `<span class="text">${n.text}</span>` : ''}
                </div>
                <div class="actions">
                    <button class="btn del" title="删除">${ICONS.trash}</button>
                </div>
            </div>
        `).join('');

        list.querySelectorAll('.btn.del').forEach(btn => {
            btn.addEventListener('click', () => {
                const uid = btn.closest('.item').dataset.uid;
                if (confirm('确定删除这条备注？')) {
                    loadNotes().then(notes => {
                        delete notes[uid];
                        chrome.storage.local.set({ [STORAGE_KEY]: notes });
                        renderList(kw);
                    });
                }
            });
        });
    });
}

document.getElementById('search').addEventListener('input', e => renderList(e.target.value.toLowerCase()));

document.getElementById('export').addEventListener('click', () => {
    loadNotes().then(notes => {
        const data = JSON.stringify(notes, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bilibili-notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
});

document.getElementById('import').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (typeof imported !== 'object' || Array.isArray(imported)) return;
                loadNotes().then(current => {
                    const merged = { ...imported, ...current };
                    chrome.storage.local.set({ [STORAGE_KEY]: merged });
                    renderList();
                });
            } catch {}
        };
        reader.readAsText(file);
    });
    input.click();
});

renderList();
