/**
 * static/mail/inbox.js
 * Full implementation with Click Listeners and Sent-folder design fixes.
 */

const MESSAGES = {
    send: { sending: 'Sending...', sent: 'Email sent successfully.', failed: 'Failed to send email.' },
    validation: { noRecipient: 'Please enter at least one recipient.' },
    load: { loading: (mb) => `Loading ${mb}...`, failed: (mb) => `Failed to load ${mb}.` },
    archive: { archived: 'Archived', unarchived: 'Moved to Inbox', failed: 'Update failed' },
    trash: { moved: 'Moved to Trash', restored: 'Restored', permDeleted: 'Permanently deleted' },
    mark: { read: 'Marked read', unread: 'Marked unread' }
};

document.addEventListener('DOMContentLoaded', () => {
    // Basic Layout Check
    if (!document.querySelector('.sidebar')) document.body.classList.add('no-sidebar');
    
    initApp();
});

function initApp() {
    setupNavigation();
    setupComposeForm();
    
    // Default view
    load_mailbox('inbox');
    setActiveNav('inbox');
}

/**
 * Navigation Setup
 */
function setupNavigation() {
    // 1. Compose Button
    document.querySelector('#compose-btn').onclick = () => compose_email();

    // 2. Map existing sidebar items
    const mailboxes = ['inbox', 'sent', 'archived'];
    mailboxes.forEach(mb => {
        const el = document.querySelector(`#${mb}`);
        if (el) el.onclick = () => load_mailbox(mb === 'archived' ? 'archive' : mb);
    });

    // 3. FIX: Ensure Trash exists and is visible in the sidebar
    let trashBtn = document.querySelector('#trash');
    if (!trashBtn) {
        const nav = document.querySelector('.nav-menu');
        trashBtn = document.createElement('div');
        trashBtn.id = 'trash';
        trashBtn.className = 'nav-item';
        trashBtn.innerHTML = `
            <svg class="nav-svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            <span class="nav-label">Trash</span>
        `;
        nav.appendChild(trashBtn);
    }
    trashBtn.onclick = () => load_mailbox('trash');
}


function setupComposeForm() {
    const form = document.querySelector('#compose-form');
    if (form) {
        form.onsubmit = (event) => {
            event.preventDefault();
            send_email();
        };
    }
}

/**
 * View Management
 */
function show_view(view) {
    document.querySelector('#emails-view').classList.toggle('hidden', view !== 'emails');
    document.querySelector('#compose-view').classList.toggle('hidden', view !== 'compose');
    document.querySelector('#email-view').classList.toggle('hidden', view !== 'email');
    
    if (view === 'compose') {
        updateToolbarTitle('New Message');
    }
}

function setActiveNav(id) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (id && document.querySelector(`#${id}`)) {
        document.querySelector(`#${id}`).classList.add('active');
        const title = id.charAt(0).toUpperCase() + id.slice(1);
        updateToolbarTitle(title);
    }
}

function updateToolbarTitle(text) {
    const title = document.querySelector('#mailbox-title');
    if (title) title.textContent = text;
}

/**
 * Mailbox Loader
 */
function load_mailbox(mailbox) {
    show_view('emails');
    const view = document.querySelector('#emails-view');
    view.innerHTML = `<div class="loading"><div class="spinner"></div><p>${MESSAGES.load.loading(mailbox)}</p></div>`;

    fetch(`/emails/${mailbox}`)
    .then(response => response.json())
    .then(emails => {
        view.innerHTML = '';
        
        if (emails.length === 0) {
            view.innerHTML = `<div class="empty-state">No messages in ${mailbox}.</div>`;
            return;
        }

        const list = document.createElement('div');
        list.className = 'emails-list';

        emails.forEach(email => {
            const row = document.createElement('div');
            // Match styles.css exactly
            row.className = `email-row ${email.read ? 'read' : 'unread'}`;
            
            // DESIGN FIX: In 'sent' mailbox, show "To: recipients", else show "Sender"
            const senderLabel = (mailbox === 'sent') ? `To: ${email.recipients.join(', ')}` : email.sender;

            row.innerHTML = `
                <div class="email-sender text-truncate">${escapeHtml(senderLabel)}</div>
                <div class="email-content">
                    <span class="email-subject">${escapeHtml(email.subject)}</span>
                    <span class="email-preview"> - ${escapeHtml(email.body.substring(0, 60))}...</span>
                </div>
                <div class="email-timestamp">${email.timestamp}</div>
            `;

            // THE CLICK FIX: Attach event listener to the container row
            row.addEventListener('click', () => view_email(email.id, mailbox));
            
            list.append(row);
        });
        
        view.append(list);
    })
    .catch(err => {
        view.innerHTML = `<div class="error-state">${MESSAGES.load.failed(mailbox)}</div>`;
    });
}

/**
 * Email Detail View
 */
/* Email Detail Layout */
.email-detail-container {
    background: #fff;
    border-radius: 12px;
    padding: 0;
    overflow: hidden;
}

/* Professional Toolbar */
.email-detail-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: #f8f9fa;
    border-bottom: 1px solid #dadce0;
    position: sticky;
    top: 0;
    z-index: 10;
}

.actions-group {
    display: flex;
    gap: 10px;
}

/* Modern Buttons */
.btn-action {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid #dadce0;
    background: #fff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s, box-shadow 0.2s;
}

.btn-action:hover {
    background: #f1f3f4;
    border-color: #bdc1c6;
}

.btn-reply {
    background: #1a73e8;
    color: #fff;
    border: none;
}

.btn-reply:hover {
    background: #1765cc;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.btn-danger {
    color: #d93025;
}

.btn-danger:hover {
    background: #fce8e6;
    border-color: #f5c2c7;
}

.btn-perm {
    background: #701516;
    color: white;
    border: none;
}

/* Email Content Styling */
.email-header-card {
    padding: 24px;
    border-bottom: 1px solid #f1f3f4;
}

.email-header-row {
    margin-bottom: 8px;
    font-size: 15px;
    color: #3c4043;
}

.email-body-content {
    padding: 24px;
    font-size: 16px;
    line-height: 1.6;
    color: #202124;
    white-space: pre-wrap;
}

/* Sidebar Trash button fix */
#trash {
    display: flex !important; /* Ensure it is visible */
}

/**
 * Composition Logic
 */
function compose_email(prefill = {}) {
    show_view('compose');
    document.querySelector('#compose-recipients').value = prefill.recipients || '';
    document.querySelector('#compose-subject').value = prefill.subject || '';
    document.querySelector('#compose-body').value = prefill.body || '';
    
    if (!prefill.recipients) {
        document.querySelector('#compose-recipients').focus();
    }
}

function send_email() {
    const recipients = document.querySelector('#compose-recipients').value;
    const subject = document.querySelector('#compose-subject').value;
    const body = document.querySelector('#compose-body').value;

    fetch('/emails', {
        method: 'POST',
        body: JSON.stringify({ recipients, subject, body })
    })
    .then(response => response.json())
    .then(result => {
        if (result.error) {
            alert(result.error);
        } else {
            load_mailbox('sent');
            setActiveNav('sent');
        }
    });
}

/**
 * Helpers
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
