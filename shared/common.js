/*
 * 共享模块 - Bilibili 用户备注助手
 * 包含 XSS 防护、DOM 工具、常量定义
 * Copyright (c) 2026 糖心月 - MIT License
 */
const BNShared = (() => {
    'use strict';

    // ==================== 常量 ====================
    const STORAGE_KEY = 'bilibili_user_notes_v2';
    const RECENT_COLORS_KEY = 'bilibili_notes_recent_colors';
    const PROCESSED_ATTR = 'data-bn-processed';
    const NOTE_MAX_CHARS = 40;

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

    // ==================== 安全 HTML 构建 ====================
    function buildTagHtml(tag, index = 0) {
        return `<span class="bn-tag" style="background-color:${safeAttr(tag.color)}"><span>${escapeHtml(tag.text)}</span><span class="bn-tag-del" data-i="${index}">${ICONS.close}</span></span>`;
    }

    function buildTooltipTagHtml(tag) {
        return `<span class="bn-tt-tag" style="background:${safeAttr(tag.color)}">${ICONS.tag}<span>${escapeHtml(tag.text)}</span></span>`;
    }

    function buildNoteTagDisplay(tag) {
        return `<span class="bili-note-tag" style="background-color:${safeAttr(tag.color)}">${ICONS.tag}<span>${escapeHtml(tag.text)}</span></span>`;
    }

    function buildManageTagHtml(tag) {
        return `<span class="bn-manage-tag" style="background-color:${safeAttr(tag.color)}">${escapeHtml(tag.text)}</span>`;
    }

    // ==================== 导出 ====================
    return {
        STORAGE_KEY, RECENT_COLORS_KEY, PROCESSED_ATTR, NOTE_MAX_CHARS,
        PRESET_COLORS, ICONS,
        escapeHtml, safeAttr,
        extractUidFromHref, findUid, findUidFromTarget,
        buildTagHtml, buildTooltipTagHtml, buildNoteTagDisplay, buildManageTagHtml,
    };
})();
