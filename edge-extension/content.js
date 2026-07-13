/*
 * Copyright (c) 2026 糖心月
 * GitHub: https://github.com/1710368392
 * SPDX-License-Identifier: MIT
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'bilibili_user_notes_v2';
    const RECENT_COLORS_KEY = 'bilibili_notes_recent_colors';
    const PROCESSED_ATTR = 'data-bn-processed';
    const TAG_MAX_LENGTH = 20;

    let _notesCache = null;
    let _notesLoaded = false;

    // ==================== XSS 防护 ====================
    const _escapeDiv = document.createElement('div');
    function escapeHtml(str) {
        if (!str) return '';
        _escapeDiv.textContent = str;
        return _escapeDiv.innerHTML;
    }
    function safeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const PRESET_COLORS = [
        { name: '朱砂', value: '#CF000F' },
        { name: '胭脂', value: '#9D2933' },
        { name: '珊瑚', value: '#F05654' },
        { name: '石榴红', value: '#F20C00' },
        { name: '绛紫', value: '#8C4356' },
        { name: '黛绿', value: '#425066' },
        { name: '竹青', value: '#789262' },
        { name: '松花', value: '#BCE672' },
        { name: '藤黄', value: '#FFB61E' },
        { name: '鹅黄', value: '#FFF143' },
        { name: '赭石', value: '#845A33' },
        { name: '赤金', value: '#B76E79' },
        { name: '靛青', value: '#177CB0' },
        { name: '月白', value: '#D6ECF0' },
        { name: '鸦青', value: '#424C50' },
        { name: '黛蓝', value: '#5B7083' },
        { name: '玄青', value: '#3D3B4F' },
        { name: '墨色', value: '#50616D' },
        { name: '银鼠', value: '#8C8C8C' },
    ];

    const ICONS = {
        tag: '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
        close: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        trash: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
        search: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    };

    const EXCLUDE_SELECTORS = [
        '.mini-avatar', '.header-entry', '.bili-header', '#app-header',
        '.bili-avatar', '.nav-user', '.nav-container', '.header-container',
        '.recommend-card', '.video-page-card', '.video-card-small',
        '.video-page-mini', '.right-container .video',
        '.comment-list', '.reply-list', '.root-reply',
        '.video-playlist', '.video-episode', '.season-item',
        '.follow-info', '.count-info',
        '.h-info', '.h-header',
    ].join(', ');

    const USERNAME_SELECTORS = [
        '.reply-user-name', '.dyn-user-name', '.up-name', '.member-name',
        '.contact-name', '.chat-user-name', '.user-name', '.info-name',
        '.relation-card-info__uname', '.h-name',
        '.upinfo .name', '.uname', '.user-card .name', '.card-name',
    ];

    // ==================== 数据层 ====================
    function loadNotes() {
        if (_notesLoaded) return _notesCache;
        return new Promise(resolve => {
            chrome.storage.local.get(STORAGE_KEY, (result) => {
                _notesCache = result[STORAGE_KEY] || {};
                _notesLoaded = true;
                resolve(_notesCache);
            });
        });
    }

    function loadNotesSync() {
        return _notesCache || {};
    }

    function saveNotes(notes) {
        _notesCache = notes;
        chrome.storage.local.set({ [STORAGE_KEY]: notes });
    }

    function getNote(uid) { return loadNotesSync()[uid] || null; }

    function setNote(uid, data) {
        const notes = loadNotesSync();
        notes[uid] = { ...data, uid, updatedAt: Date.now() };
        saveNotes(notes);
    }

    function removeNote(uid) {
        const notes = loadNotesSync();
        delete notes[uid];
        saveNotes(notes);
    }

    function getRecentColors() {
        return new Promise(resolve => {
            chrome.storage.local.get(RECENT_COLORS_KEY, (result) => {
                resolve(result[RECENT_COLORS_KEY] || []);
            });
        });
    }

    function addRecentColor(color) {
        getRecentColors().then(colors => {
            colors = colors.filter(c => c !== color);
            colors.unshift(color);
            if (colors.length > 6) colors = colors.slice(0, 6);
            chrome.storage.local.set({ [RECENT_COLORS_KEY]: colors });
        });
    }

    function showToast(msg) {
        const t = document.createElement('div');
        t.textContent = msg;
        Object.assign(t.style, {
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            background: '#18191c', color: '#fff', padding: '10px 20px',
            borderRadius: '8px', fontSize: '13px', fontWeight: '500',
            zIndex: '999999', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            animation: 'bn-toast-in 0.2s ease',
        });
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 1500);
        setTimeout(() => t.remove(), 1800);
    }

    // ==================== DOM 工具 ====================
    function extractUidFromHref(href) {
        if (!href) return null;
        const m = href.match(/(?:space\.bilibili\.com|bilibili\.com\/space)\/(\d+)/);
        return m ? m[1] : null;
    }

    function findUid(el) {
        for (let i = 0; i < 6 && el; i++) {
            if (el.tagName === 'A') {
                const uid = extractUidFromHref(el.getAttribute('href'));
                if (uid) return uid;
            }
            const selfUid = el.getAttribute?.('data-user-id') || el.getAttribute?.('data-uid') || el.getAttribute?.('data-mid');
            if (selfUid && /^\d+$/.test(selfUid)) return selfUid;
            const innerLink = el.querySelector?.(':scope > a[href*="space.bilibili.com"], :scope > a[href*="bilibili.com/space"]');
            if (innerLink) {
                const uid = extractUidFromHref(innerLink.getAttribute('href'));
                if (uid) return uid;
            }
            el = el.parentElement;
        }
        return null;
    }

    function findUidFromTarget(target) {
        if (target.tagName === 'A') {
            const uid = extractUidFromHref(target.getAttribute('href'));
            if (uid) return { uid, el: target };
        }
        const selfUid = target.getAttribute?.('data-user-id') || target.getAttribute?.('data-uid') || target.getAttribute?.('data-mid');
        if (selfUid && /^\d+$/.test(selfUid)) return { uid: selfUid, el: target };

        let current = target;
        for (let i = 0; i < 8 && current; i++) {
            const isNameEl = current.classList && (
                current.classList.contains('name') || current.classList.contains('username') ||
                current.classList.contains('user-name') || current.classList.contains('reply-user-name') ||
                current.classList.contains('dyn-user-name') || current.classList.contains('up-name') ||
                current.classList.contains('member-name') || current.classList.contains('contact-name') ||
                current.classList.contains('chat-user-name') || current.classList.contains('info-name')
            );
            if (isNameEl) {
                const link = current.querySelector('a[href*="space.bilibili.com"]') ||
                             current.closest('a[href*="space.bilibili.com"]') ||
                             current.parentElement?.querySelector('a[href*="space.bilibili.com"]');
                if (link) {
                    const uid = extractUidFromHref(link.getAttribute('href'));
                    if (uid) return { uid, el: current };
                }
                const uidAttr = current.getAttribute('data-user-id') || current.getAttribute('data-uid');
                if (uidAttr && /^\d+$/.test(uidAttr)) return { uid: uidAttr, el: current };
            }
            if (current.tagName === 'A') {
                const uid = extractUidFromHref(current.getAttribute('href'));
                if (uid) return { uid, el: current };
            }
            current = current.parentElement;
        }
        return { uid: null, el: null };
    }

    // ==================== 注入逻辑 ====================
    const NOTE_MAX_CHARS = 40;

    function injectNote(uid, nameEl) {
        if (nameEl.nextElementSibling?.classList?.contains('bili-note-wrapper')) return;
        const note = getNote(uid);
        if (!note) return;
        const hasTags = note.tags && note.tags.length > 0;
        const hasText = note.text;
        if (!hasTags && !hasText) return;

        const fullParts = [];
        if (hasTags) note.tags.forEach(t => fullParts.push(t.text));
        if (hasText) fullParts.push(note.text);
        const fullText = fullParts.join(' · ');

        const wrapper = document.createElement('span');
        wrapper.className = 'bili-note-wrapper';

        if (hasTags) {
            let budget = NOTE_MAX_CHARS;
            for (const tag of note.tags) {
                const tagCost = tag.text.length + 2;
                if (budget <= 0) break;
                const el = document.createElement('span');
                el.className = 'bili-note-tag';
                el.style.backgroundColor = safeAttr(tag.color);
                el.innerHTML = `<span>${escapeHtml(tag.text)}</span>`;
                wrapper.appendChild(el);
                budget -= tagCost;
            }
        }
        if (hasText) {
            const el = document.createElement('span');
            el.className = 'bili-note-text';
            const tagsLen = hasTags ? note.tags.reduce((s, t) => s + t.text.length + 2, 0) : 0;
            const remaining = NOTE_MAX_CHARS - Math.min(tagsLen, NOTE_MAX_CHARS);
            el.textContent = remaining <= 0 ? '...' : note.text.length > remaining ? note.text.slice(0, remaining - 3) + '...' : note.text;
            wrapper.appendChild(el);
        }

        nameEl.insertAdjacentElement('afterend', wrapper);

        if (fullText.length > 15) {
            const tooltip = document.createElement('div');
            tooltip.className = 'bili-note-tooltip-fixed';
            let tooltipHtml = '';
            if (hasTags) note.tags.forEach((tag, i) => {
                if (i > 0) tooltipHtml += '<span class="bn-tt-sep">·</span>';
                tooltipHtml += `<span class="bn-tt-tag" style="background:${safeAttr(tag.color)}">${ICONS.tag}<span>${escapeHtml(tag.text)}</span></span>`;
            });
            if (hasText) {
                if (hasTags) tooltipHtml += '<span class="bn-tt-sep">·</span>';
                tooltipHtml += `<span class="bn-tt-text">${escapeHtml(note.text)}</span>`;
            }
            tooltip.innerHTML = tooltipHtml;
            document.body.appendChild(tooltip);
            // 存储 tooltip 引用，便于清理
            wrapper._tooltip = tooltip;
            wrapper.querySelectorAll('.bili-note-tag, .bili-note-text').forEach(el => {
                el.addEventListener('mouseenter', () => {
                    const rect = el.getBoundingClientRect();
                    tooltip.style.left = rect.left + 'px';
                    tooltip.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
                    tooltip.style.top = 'auto';
                    tooltip.style.display = 'flex';
                });
                el.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
            });
        }
    }

    function processSpacePage() {
        if (!location.hostname.includes('space.bilibili.com')) return;
        const urlMatch = location.pathname.match(/\/(\d+)/);
        if (!urlMatch) return;
        const uid = urlMatch[1];
        const note = getNote(uid);
        if (!note) return;
        const hasTags = note.tags && note.tags.length > 0;
        const hasText = note.text;
        if (!hasTags && !hasText) return;

        const descEl = document.querySelector('.h-sign, .h-desc, .desc, .sign, [class*="sign"], [class*="desc"]');
        if (!descEl || descEl.getAttribute(PROCESSED_ATTR)) return;
        if (descEl.nextElementSibling?.classList?.contains('bili-note-wrapper')) return;

        descEl.setAttribute(PROCESSED_ATTR, '1');
        const fullParts = [];
        if (hasTags) note.tags.forEach(t => fullParts.push(t.text));
        if (hasText) fullParts.push(note.text);
        const fullText = fullParts.join(' · ');

        const wrapper = document.createElement('span');
        wrapper.className = 'bili-note-wrapper';
        if (hasTags) {
            let budget = NOTE_MAX_CHARS;
            for (const tag of note.tags) {
                const tagCost = tag.text.length + 2;
                if (budget <= 0) break;
                const el = document.createElement('span');
                el.className = 'bili-note-tag';
                el.style.backgroundColor = safeAttr(tag.color);
                el.innerHTML = `<span>${escapeHtml(tag.text)}</span>`;
                wrapper.appendChild(el);
                budget -= tagCost;
            }
        }
        if (hasText) {
            const el = document.createElement('span');
            el.className = 'bili-note-text';
            el.textContent = note.text;
            wrapper.appendChild(el);
        }
        descEl.insertAdjacentElement('afterend', wrapper);

        if (fullText.length > 15) {
            const tooltip = document.createElement('div');
            tooltip.className = 'bili-note-tooltip-fixed';
            let tooltipHtml = '';
            if (hasTags) note.tags.forEach((tag, i) => {
                if (i > 0) tooltipHtml += '<span class="bn-tt-sep">·</span>';
                tooltipHtml += `<span class="bn-tt-tag" style="background:${safeAttr(tag.color)}">${ICONS.tag}<span>${escapeHtml(tag.text)}</span></span>`;
            });
            if (hasText) {
                if (hasTags) tooltipHtml += '<span class="bn-tt-sep">·</span>';
                tooltipHtml += `<span class="bn-tt-text">${escapeHtml(note.text)}</span>`;
            }
            tooltip.innerHTML = tooltipHtml;
            document.body.appendChild(tooltip);
            wrapper._tooltip = tooltip;
            wrapper.querySelectorAll('.bili-note-tag, .bili-note-text').forEach(el => {
                el.addEventListener('mouseenter', () => {
                    const rect = el.getBoundingClientRect();
                    tooltip.style.left = rect.left + 'px';
                    tooltip.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
                    tooltip.style.top = 'auto';
                    tooltip.style.display = 'flex';
                });
                el.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
            });
        }
    }

    function processPage() {
        const processed = new Set();
        processSpacePage();
        USERNAME_SELECTORS.forEach(sel => {
            document.querySelectorAll(sel).forEach(nameEl => {
                if (nameEl.closest(EXCLUDE_SELECTORS)) return;
                if (nameEl.getAttribute(PROCESSED_ATTR)) return;
                if (nameEl.nextElementSibling?.classList?.contains('bili-note-wrapper')) return;
                const text = nameEl.textContent?.trim();
                if (!text || text.length < 1 || text.length > 20) return;
                const uid = findUid(nameEl);
                if (!uid) return;
                const key = uid + '_' + sel;
                if (processed.has(key)) return;
                processed.add(key);
                nameEl.setAttribute(PROCESSED_ATTR, '1');
                injectNote(uid, nameEl);
            });
        });
    }

    function refreshAll() {
        // 先清理所有关联的 tooltip
        document.querySelectorAll('.bili-note-wrapper').forEach(el => {
            if (el._tooltip) el._tooltip.remove();
            el.remove();
        });
        // 清理剩余的孤立 tooltip
        document.querySelectorAll('.bili-note-tooltip-fixed').forEach(el => el.remove());
        document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => el.removeAttribute(PROCESSED_ATTR));
        processPage();
    }

    // ==================== Shift+右键触发 ====================
    function handleContextMenu(e) {
        if (!e.shiftKey) return;
        if (location.hostname.includes('space.bilibili.com')) {
            const isSubPage = location.pathname.includes('/relation/') || location.pathname.includes('/upload') || location.pathname.includes('/dynamic');
            if (!isSubPage) {
                const levelArea = e.target.closest('.h-level, .h-info, [class*="level"], [class*="vip"]');
                if (!levelArea) return;
                const urlMatch = location.pathname.match(/\/(\d+)/);
                if (!urlMatch) return;
                e.preventDefault();
                const uid = urlMatch[1];
                const userName = document.querySelector('.h-name')?.textContent?.trim() || '';
                setTimeout(() => showModal(uid, userName, getNote(uid)), 50);
                return;
            }
        }
        const { uid, el } = findUidFromTarget(e.target);
        if (!uid) return;
        e.preventDefault();
        let userName = '';
        if (el) {
            const nameEl = el.classList?.contains('name') || el.classList?.contains('username') ||
                           el.classList?.contains('user-name') || el.classList?.contains('reply-user-name') ||
                           el.classList?.contains('dyn-user-name') || el.classList?.contains('up-name')
                ? el : el.querySelector?.('.name, .username, .user-name, .reply-user-name, .dyn-user-name, .up-name');
            userName = nameEl?.textContent?.trim() || el.textContent?.trim() || '';
            if (userName.length > 25) userName = '';
        }
        setTimeout(() => showModal(uid, userName, getNote(uid)), 50);
    }

    // ==================== 弹窗 ====================
    let currentModal = null;

    function showModal(uid, userName, noteData = null) {
        if (currentModal) currentModal.remove();
        const isNew = !noteData;
        const tags = noteData?.tags || [];
        const mask = document.createElement('div');
        mask.className = 'bili-note-mask';
        mask.setAttribute('role', 'dialog');
        mask.setAttribute('aria-modal', 'true');
        mask.setAttribute('aria-label', isNew ? '添加备注' : '编辑备注');
        const modal = document.createElement('div');
        modal.className = 'bili-note-modal';

        modal.innerHTML = `
            <div class="bn-header">
                <span class="bn-title">${ICONS.tag} ${isNew ? '添加备注' : '编辑备注'}</span>
                <button class="bn-close">${ICONS.close}</button>
            </div>
            <div class="bn-body">
                <div class="bn-row">
                    <span class="bn-label">用户</span>
                    <input type="text" class="bn-input" readonly value="${safeAttr(userName || 'UID: ' + uid)}">
                </div>
                <div class="bn-row">
                    <span class="bn-label">标签</span>
                    <div class="bn-tags-area">
                        <div class="bn-tags-box" id="bn-tags"></div>
                        <div class="bn-tag-input-row">
                            <div class="bn-color-dot" id="bn-dot" title="点击选择颜色"></div>
                            <textarea class="bn-tag-input" id="bn-tag-input" placeholder="输入标签文字，回车添加" rows="1" maxlength="${TAG_MAX_LENGTH}"></textarea>
                            <span class="bn-tag-counter" id="bn-tag-counter">0/${TAG_MAX_LENGTH}</span>
                            <div class="bn-color-popup" id="bn-color-popup" style="display:none;"></div>
                        </div>
                        <div class="bn-tag-hint">输入文字后按 <kbd>Enter</kbd> 添加标签（最多 ${TAG_MAX_LENGTH} 字），点击圆点选择颜色</div>
                    </div>
                </div>
                <div class="bn-row">
                    <span class="bn-label">备注</span>
                    <div class="bn-tags-area">
                        <textarea class="bn-input" id="bn-text" placeholder="备注内容" rows="1">${escapeHtml(noteData?.text || '')}</textarea>
                        <div class="bn-tag-hint" style="margin-top: 6px;">
                            <span style="color: #9499a0; font-size: 11px;">快速添加：</span>
                            <span class="bn-template-btn" data-text="大佬">大佬</span>
                            <span class="bn-template-btn" data-text="同好">同好</span>
                            <span class="bn-template-btn" data-text="广告">广告</span>
                            <span class="bn-template-btn" data-text="水友">水友</span>
                            <span class="bn-template-btn" data-text="UP主">UP主</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="bn-footer">
                ${noteData ? `<button class="bn-btn bn-btn-danger" id="bn-delete">${ICONS.trash} 删除</button>` : ''}
                <button class="bn-btn bn-btn-default" id="bn-cancel">取消</button>
                <button class="bn-btn bn-btn-primary" id="bn-save">${ICONS.check} 保存</button>
            </div>
        `;

        mask.appendChild(modal);
        document.body.appendChild(mask);
        currentModal = mask;

        // 焦点锁定 - Tab 键只在弹窗内循环
        const focusableSelectors = 'textarea, button, [tabindex]:not([tabindex="-1"])';
        const focusableElements = modal.querySelectorAll(focusableSelectors);
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
            modal.addEventListener('keydown', (e) => {
                if (e.key !== 'Tab') return;
                const firstEl = focusableElements[0];
                const lastEl = focusableElements[focusableElements.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
                } else {
                    if (document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
                }
            });
        }

        let editingTags = [...tags];
        let selectedColor = PRESET_COLORS[0].value;
        const tagsBox = modal.querySelector('#bn-tags');
        const tagInput = modal.querySelector('#bn-tag-input');
        const colorPopup = modal.querySelector('#bn-color-popup');
        const colorDot = modal.querySelector('#bn-dot');

        function updateDot() { colorDot.style.backgroundColor = selectedColor; }

        // 自动调整 textarea 高度
        function autoResize(el) {
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 80) + 'px';
        }
        autoResize(tagInput);
        tagInput.addEventListener('input', () => autoResize(tagInput));

        // 备注 textarea 自动调整
        const textInput = modal.querySelector('#bn-text');
        if (textInput) {
            autoResize(textInput);
            textInput.addEventListener('input', () => autoResize(textInput));
        }

        // 备注模板按钮
        modal.querySelectorAll('.bn-template-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.text;
                if (textInput && text) {
                    textInput.value = text;
                    autoResize(textInput);
                    textInput.focus();
                }
            });
        });

        // 拖拽排序
        let dragIndex = null;
        function setupDrag() {
            tagsBox.querySelectorAll('.bn-tag').forEach((tag, i) => {
                tag.setAttribute('draggable', 'true');
                tag.addEventListener('dragstart', (e) => {
                    dragIndex = i;
                    tag.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                });
                tag.addEventListener('dragend', () => {
                    tag.classList.remove('dragging');
                    tagsBox.querySelectorAll('.bn-tag').forEach(t => t.classList.remove('drag-over'));
                    dragIndex = null;
                });
                tag.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    tag.classList.add('drag-over');
                });
                tag.addEventListener('dragleave', () => {
                    tag.classList.remove('drag-over');
                });
                tag.addEventListener('drop', (e) => {
                    e.preventDefault();
                    tag.classList.remove('drag-over');
                    const dropIndex = i;
                    if (dragIndex === null || dragIndex === dropIndex) return;
                    const [moved] = editingTags.splice(dragIndex, 1);
                    editingTags.splice(dropIndex, 0, moved);
                    renderTags();
                });
            });
        }

        function renderTags() {
            tagsBox.innerHTML = editingTags.map((t, i) => `
                <span class="bn-tag" style="background-color:${safeAttr(t.color)}">
                    <span>${escapeHtml(t.text)}</span>
                    <span class="bn-tag-del" data-i="${i}">${ICONS.close}</span>
                </span>
            `).join('');
            tagsBox.querySelectorAll('.bn-tag-del').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    editingTags.splice(parseInt(btn.dataset.i), 1);
                    renderTags();
                });
            });
            setupDrag();
        }

        async function showColorPopup() {
            const recentColors = await getRecentColors();
            colorPopup.innerHTML = `
                <div class="bn-color-title">自定义颜色</div>
                <div style="margin-bottom: 10px;">
                    <input type="color" id="bn-custom-color" value="${safeAttr(selectedColor)}" style="width: 100%; height: 30px; border: 1px solid #e3e5e7; border-radius: 6px; cursor: pointer; padding: 0;">
                </div>
                ${recentColors.length > 0 ? `
                    <div class="bn-color-title">最近使用</div>
                    <div class="bn-color-grid" style="margin-bottom: 10px;">
                        ${recentColors.map(c => `<div class="bn-color-item ${selectedColor === c ? 'active' : ''}" style="background-color:${safeAttr(c)}" data-color="${safeAttr(c)}" data-code="${safeAttr(c)}"></div>`).join('')}
                    </div>
                ` : ''}
                <div class="bn-color-title">预设颜色</div>
                <div class="bn-color-grid">
                    ${PRESET_COLORS.map(c => `<div class="bn-color-item ${selectedColor === c.value ? 'active' : ''}" style="background-color:${safeAttr(c.value)}" data-color="${safeAttr(c.value)}" data-code="${safeAttr(c.value)}"></div>`).join('')}
                </div>
            `;
            colorPopup.style.display = 'block';
            // 自定义颜色选择器
            const customColorInput = colorPopup.querySelector('#bn-custom-color');
            if (customColorInput) {
                customColorInput.addEventListener('input', (e) => {
                    selectedColor = e.target.value;
                    addRecentColor(selectedColor);
                    updateDot();
                    // 更新所有颜色项的选中状态
                    colorPopup.querySelectorAll('.bn-color-item').forEach(i => i.classList.remove('active'));
                });
                customColorInput.addEventListener('change', (e) => {
                    selectedColor = e.target.value;
                    addRecentColor(selectedColor);
                    updateDot();
                    colorPopup.style.display = 'none';
                    tagInput.focus();
                });
            }
            colorPopup.querySelectorAll('.bn-color-item').forEach(item => {
                item.addEventListener('click', () => {
                    selectedColor = item.dataset.color;
                    addRecentColor(selectedColor);
                    updateDot();
                    colorPopup.querySelectorAll('.bn-color-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    colorPopup.style.display = 'none';
                    tagInput.focus();
                });
            });
        }

        colorDot.addEventListener('click', e => { e.stopPropagation(); colorPopup.style.display === 'block' ? colorPopup.style.display = 'none' : showColorPopup(); });
        const _onDocClick = e => { if (!e.target.closest('.bn-tag-input-row')) colorPopup.style.display = 'none'; };
        document.addEventListener('click', _onDocClick);

        // 保存清理函数，弹窗关闭时移除监听器
        mask._cleanup = () => {
            document.removeEventListener('click', _onDocClick);
        };

        // 标签字数计数器
        const tagCounter = modal.querySelector('#bn-tag-counter');
        function updateTagCounter() {
            const len = tagInput.value.length;
            tagCounter.textContent = `${len}/${TAG_MAX_LENGTH}`;
            tagCounter.classList.toggle('warn', len >= TAG_MAX_LENGTH);
        }
        tagInput.addEventListener('input', updateTagCounter);
        updateTagCounter();

        // 未保存变更检测
        let _hasUnsavedChanges = false;
        function checkUnsavedChanges() {
            const currentText = modal.querySelector('#bn-text').value;
            const origText = noteData?.text || '';
            const origTagsStr = JSON.stringify(noteData?.tags || []);
            const curTagsStr = JSON.stringify(editingTags);
            _hasUnsavedChanges = currentText !== origText || origTagsStr !== curTagsStr;
        }
        modal.querySelector('#bn-text').addEventListener('input', checkUnsavedChanges);
        // 标签变化时也检测
        const _origRenderTags = renderTags;
        renderTags = function() { _origRenderTags(); checkUnsavedChanges(); };

        tagInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = tagInput.value.trim();
                if (text) {
                    if (text.length > TAG_MAX_LENGTH) {
                        showToast(`标签最多 ${TAG_MAX_LENGTH} 个字符`);
                        return;
                    }
                    editingTags.push({ text, color: selectedColor });
                    renderTags();
                    tagInput.value = '';
                    autoResize(tagInput);
                    updateTagCounter();
                }
            }
        });

        updateDot();
        renderTags();

        // 带确认的关闭
        function confirmClose() {
            checkUnsavedChanges();
            if (_hasUnsavedChanges) {
                if (!confirm('有未保存的更改，确定关闭吗？')) return;
            }
            closeModal();
        }

        modal.querySelector('.bn-close').addEventListener('click', confirmClose);
        modal.querySelector('#bn-cancel').addEventListener('click', confirmClose);
        mask.addEventListener('click', e => { if (e.target === mask) confirmClose(); });

        modal.querySelector('#bn-save').addEventListener('click', () => {
            setNote(uid, { name: userName, tags: editingTags, text: modal.querySelector('#bn-text').value.trim() });
            _hasUnsavedChanges = false;
            refreshAll();
            closeModal();
            showToast(isNew ? '备注已添加' : '备注已更新');
        });

        modal.querySelector('#bn-delete')?.addEventListener('click', () => {
            if (confirm(`确定删除 ${userName || uid} 的备注？`)) {
                removeNote(uid);
                _hasUnsavedChanges = false;
                refreshAll();
                closeModal();
                showToast('备注已删除');
            }
        });

        // keydown 监听器 - 存储以便清理
        const _onKeydown = (e) => {
            if (e.key === 'Escape') { confirmClose(); }
        };
        document.addEventListener('keydown', _onKeydown);

        // 更新清理函数，包含 keydown 监听器
        const _origCleanup = mask._cleanup;
        mask._cleanup = () => {
            document.removeEventListener('keydown', _onKeydown);
            if (_origCleanup) _origCleanup();
        };
    }

    function closeModal() {
        if (currentModal) {
            if (currentModal._cleanup) currentModal._cleanup();
            currentModal.remove();
        }
        currentModal = null;
    }

    // ==================== 初始化 ====================
    function init() {
        loadNotes().then(() => {
            setTimeout(processPage, 2000);

            // 首次使用引导
            const FIRST_USE_KEY = 'bilibili_notes_first_use_done';
            if (!localStorage.getItem(FIRST_USE_KEY)) {
                setTimeout(() => {
                    const guide = document.createElement('div');
                    guide.className = 'bili-note-tooltip-fixed';
                    guide.style.cssText = 'display:flex; bottom:auto; top: 20px; left: 50%; transform: translateX(-50%); z-index: 2147483647; white-space: nowrap;';
                    guide.innerHTML = `<span class="bn-tt-text" style="color:#e1e1e1;">按住 <b>Shift</b> + <b>右键</b> 点击用户名即可添加备注</span>`;
                    document.body.appendChild(guide);
                    setTimeout(() => {
                        guide.style.opacity = '0';
                        guide.style.transition = 'opacity 0.5s';
                        setTimeout(() => guide.remove(), 500);
                    }, 3000);
                    localStorage.setItem(FIRST_USE_KEY, '1');
                }, 2500);
            }

            // 防抖处理页面更新
            let _processTimer = null;
            function scheduleProcess(delay = 800) {
                if (_processTimer) clearTimeout(_processTimer);
                _processTimer = setTimeout(processPage, delay);
            }

            // 监听 SPA 路由变化（popstate + hashchange）
            window.addEventListener('popstate', () => scheduleProcess(500), true);
            window.addEventListener('hashchange', () => scheduleProcess(500), true);

            // 监听 pushState/replaceState（SPA 跳转）
            const _origPush = history.pushState;
            const _origReplace = history.replaceState;
            history.pushState = function () {
                _origPush.apply(this, arguments);
                scheduleProcess(500);
            };
            history.replaceState = function () {
                _origReplace.apply(this, arguments);
                scheduleProcess(500);
            };

            // MutationObserver 监听 DOM 变化（动态加载内容）
            const _observer = new MutationObserver((mutations) => {
                let hasNewNodes = false;
                for (const m of mutations) {
                    if (m.type === 'childList' && m.addedNodes.length > 0) {
                        for (const node of m.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE && !node.classList?.contains('bili-note-wrapper')) {
                                hasNewNodes = true;
                                break;
                            }
                        }
                    }
                    if (hasNewNodes) break;
                }
                if (hasNewNodes) scheduleProcess(1500);
            });
            _observer.observe(document.body, { childList: true, subtree: true });

            document.addEventListener('contextmenu', handleContextMenu, true);
        });
    }

    if (document.readyState === 'complete') init();
    else window.addEventListener('load', init);
})();
