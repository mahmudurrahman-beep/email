// static/mail/inbox.js
// inbox.js - inbox client with archive guard for Sent and Trash feature-detection
// All user-facing strings centralized in MESSAGES for easy edits/localization.

const MESSAGES = {
    send: { sending: 'Sending...', sent: 'Email sent.', failed: 'Failed to send email.' },
    validation: { noRecipient: 'Please enter at least one recipient.' },
    load: { loading: (mb) => `Loading ${mb}...`, failed: (mb) => `Failed to load ${mb}.` },
    archive: { archived: 'Archived', unarchivedInbox: 'Moved to Inbox', unarchivedSent: 'Moved to Sent', failed: 'Update failed' },
    trash: { notSupported: 'Delete not supported by server', moved: 'Moved to Trash', restored: 'Restored', failedMove: 'Failed to move to Trash', permDeleted: 'Permanently deleted', permFailed: 'Permanent delete failed' },
    restore: { toArchive: 'Restored to Archive', toSent: 'Restored to Sent', toInbox: 'Restored to Inbox', failed: 'Restore failed' },
    mark: { read: 'Marked read', unread: 'Marked unread', failed: 'Failed to update read state' },
    confirm: { permDelete: 'Permanently delete this message? This cannot be undone.' },
    compose: { newEmail: 'New Email' }
};

document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.sidebar')) document.body.classList.add('no-sidebar');
    initApp();
});

let SUPPORTS_TRASH = true;

function initApp() {
    setupNavigation();
    setupComposeForm();
    ensureViewsExist();
    detectTrashSupport();
    load_mailbox('inbox');
    setActiveNav('inbox');
}

/* Feature detect Trash endpoint */
function detectTrashSupport() {
    fetch('/emails/trash')
        .then(res => {
            if (!res.ok) {
                SUPPORTS_TRASH = false;
                const trashNav = document.querySelector('#trash');
                if (trashNav) trashNav.style.display = 'none';
            } else {
                SUPPORTS_TRASH = true;
            }
        })
        .catch(() => {
            SUPPORTS_TRASH = false;
            const trashNav = document.querySelector('#trash');
            if (trashNav) trashNav.style.display = 'none';
        });
}

/* Navigation & events */
function setupNavigation() {
    const composeBtn = document.querySelector('#compose-btn') || document.querySelector('.compose-btn');
    if (composeBtn) composeBtn.addEventListener('click', () => {
        compose_email();
        setActiveNav(null);
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function () {
            const mailbox = this.id === 'archived' ? 'archive' : this.id;
            load_mailbox(mailbox);
            setActiveNav(this.id);
        });
    });

    if (!document.querySelector('#trash')) {
        const nav = document.querySelector('.nav-menu');
        if (nav) {
            const div = document.createElement('div');
            div.id = 'trash';
            div.className = 'nav-item';
            div.setAttribute('role', 'button');
            div.tabIndex = 0;
            div.innerHTML = `<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg><span class="nav-label">Trash</span>`;
            nav.appendChild(div);
            div.addEventListener('click', () => {
                load_mailbox('trash');
                setActiveNav('trash');
            });
        }
    }

    const cancelBtn = document.querySelector('#cancel-compose');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
        load_mailbox('inbox');
        setActiveNav('inbox');
    });
}

function setupComposeForm() {
    const form = document.querySelector('#compose-form');
    if (form) form.addEventListener('submit', send_email);
}

function ensureViewsExist() {
    if (!document.querySelector('#email-view')) {
        const emailView = document.createElement('div');
        emailView.id = 'email-view';
        emailView.className = 'hidden';
        const container = document.querySelector('.content-area') || document.querySelector('.content-body') || document.body;
        container.appendChild(emailView);
    }
}

/* View management */
function show_view(view) {
    const emailsView = document.querySelector('#emails-view');
    const composeView = document.querySelector('#compose-view');
    const emailView = document.querySelector('#email-view');

    if (emailsView) emailsView.classList.add('hidden');
    if (composeView) composeView.classList.add('hidden');
    if (emailView) emailView.classList.add('hidden');

    document.body.classList.remove('compose-active');

    if (view === 'emails' && emailsView) emailsView.classList.remove('hidden');
    else if (view === 'compose' && composeView) {
        composeView.classList.remove('hidden');
        updateToolbarTitle(MESSAGES.compose.newEmail);
        document.body.classList.add('compose-active');
    } else if (view === 'email' && emailView) {
        emailView.classList.remove('hidden');
    }
}

function setActiveNav(activeId) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.body.classList.remove('trash-view');
    if (activeId) {
        const el = document.querySelector(`#${activeId}`);
        if (el) el.classList.add('active');
        if (activeId === 'trash') document.body.classList.add('trash-view');
        updateToolbarTitle(activeId === 'archived' ? 'Archive' : capitalize(activeId));
    } else {
        updateToolbarTitle('');
    }
}

function updateToolbarTitle(text) {
    const title = document.querySelector('.content-toolbar h2') || document.querySelector('#mailbox-title');
    if (title) title.textContent = text;
}

/* Compose */
function compose_email(prefill = {}) {
    show_view('compose');
    const r = document.querySelector('#compose-recipients');
    const s = document.querySelector('#compose-subject');
    const b = document.querySelector('#compose-body');
    if (r) r.value = prefill.recipients || '';
    if (s) s.value = prefill.subject || '';
    if (b) b.value = prefill.body || '';
    if (r && !prefill.recipients) setTimeout(() => r.focus(), 80);
}

/* Send */
function send_email(event) {
    event.preventDefault();
    const recipients = (document.querySelector('#compose-recipients') || {}).value || '';
    const subject = (document.querySelector('#compose-subject') || {}).value || '';
    const body = (document.querySelector('#compose-body') || {}).value || '';

    if (!recipients.trim()) {
        show_notification(MESSAGES.validation.noRecipient, 'error');
        return;
    }

    show_notification(MESSAGES.send.sending, 'info');
    fetch('/emails', {
        method: 'POST',
        body: JSON.stringify({
            recipients: recipients.trim(),
            subject: subject.trim(),
            body: body.trim()
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) show_notification(data.error, 'error');
        else {
            show_notification(MESSAGES.send.sent, 'success');
            load_mailbox('sent');
            setActiveNav('sent');
        }
    })
    .catch(() => show_notification(MESSAGES.send.failed, 'error'));
}

/* Load mailbox */
function load_mailbox(mailbox) {
    show_view('emails');
    const view = document.querySelector('#emails-view');
    if (!view) return;
    view.innerHTML = '';

    const loading = document.createElement('div');
    loading.className = 'loading-state';
    loading.innerHTML = `<div class="spinner"></div><p>${escapeHtml(MESSAGES.load.loading(capitalize(mailbox)))}</p>`;
    view.appendChild(loading);

    fetch(`/emails/${mailbox}`)
        .then(res => {
            if (!res.ok) throw new Error('Failed to load mailbox');
            return res.json();
        })
        .then(emails => {
            view.innerHTML = '';
            if (!Array.isArray(emails) || emails.length === 0) {
                showEmptyState(mailbox, view);
                return;
            }
            const list = document.createElement('div');
            list.className = 'emails-list';
            emails.forEach(email => list.appendChild(createEmailElement(email, mailbox)));
            view.appendChild(list);
        })
        .catch(() => {
            view.innerHTML = `<div class="error-state"><p>${escapeHtml(MESSAGES.load.failed(capitalize(mailbox)))}</p></div>`;
        });
}

function createEmailElement(email, mailbox) {
    const div = document.createElement('div');
    div.className = 'email-item ' + (email.read ? 'read' : 'unread');
    div.setAttribute('data-id', email.id);
    
    // Fallback for missing body preview logic
    const previewText = email.body || '';
    const ts = formatTimestamp(email.timestamp);

    div.innerHTML = `
        <div class="email-sender">${escapeHtml(email.sender)}</div>
        <div class="email-content">
            <div class="email-subject">${escapeHtml(email.subject || '(no subject)')}</div>
            <div class="email-preview">${escapeHtml(previewText.substring(0, 120))}${previewText.length > 120 ? '...' : ''}</div>
        </div>
        <div class="email-timestamp">${escapeHtml(ts)}</div>
    `;
    div.addEventListener('click', () => view_email(email.id, mailbox));
    return div;
}

/* Utilities */
function formatTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const opts = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
    return d.toLocaleString('en-US', opts);
}

function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function capitalize(s) { 
    if (!s) return ''; 
    return s.charAt(0).toUpperCase() + s.slice(1); 
}

// Stubs for functions referenced but not fully defined in snippet
function show_notification(msg, type) { console.log(`[${type}] ${msg}`); }
function showEmptyState(mailbox, view) { view.innerHTML = `<p>No emails in ${mailbox}.</p>`; }
function view_email(id, mailbox) { console.log(`Viewing email ${id} from ${mailbox}`); }
