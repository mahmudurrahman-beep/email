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
function view_email(email_id, mailbox) {
    show_view('email');
    const view = document.querySelector('#email-view');
    view.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    fetch(`/emails/${email_id}`)
    .then(response => response.json())
    .then(email => {
        // Mark as Read
        if (!email.read) {
            fetch(`/emails/${email_id}`, {
                method: 'PUT',
                body: JSON.stringify({ read: true })
            });
        }

        view.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'email-detail-container';

        // Buttons Logic
        const isTrash = (mailbox === 'trash' || email.deleted);
        const archiveText = email.archived ? 'Unarchive' : 'Archive';
        const trashText = isTrash ? 'Restore' : 'Move to Trash';

        container.innerHTML = `
            <div class="email-detail-header">
                <button class="btn-action" id="btn-back">← Back</button>
                <button class="btn-action btn-reply" id="btn-reply">Reply</button>
                <button class="btn-action" id="btn-archive">${archiveText}</button>
                <button class="btn-action" id="btn-trash" style="color: #d93025">${trashText}</button>
                ${isTrash ? '<button class="btn-action" id="btn-perm-delete" style="color: #701516">Delete Permanently</button>' : ''}
            </div>
            <div class="email-header">
                <div class="email-header-row"><span class="header-label">From:</span> ${escapeHtml(email.sender)}</div>
                <div class="email-header-row"><span class="header-label">To:</span> ${escapeHtml(email.recipients.join(', '))}</div>
                <div class="email-header-row"><span class="header-label">Subject:</span> ${escapeHtml(email.subject)}</div>
                <div class="email-header-row"><span class="header-label">Date:</span> ${email.timestamp}</div>
            </div>
            <div class="email-body">${escapeHtml(email.body)}</div>
        `;

        view.append(container);

        // Listeners
        document.querySelector('#btn-back').onclick = () => load_mailbox(mailbox);
        
        document.querySelector('#btn-reply').onclick = () => {
            compose_email({
                recipients: email.sender,
                subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
                body: `\n\n--- On ${email.timestamp} ${email.sender} wrote:\n${email.body}`
            });
        };

        document.querySelector('#btn-archive').onclick = () => {
            fetch(`/emails/${email_id}`, {
                method: 'PUT',
                body: JSON.stringify({ archived: !email.archived })
            }).then(() => load_mailbox('inbox'));
        };

        document.querySelector('#btn-trash').onclick = () => {
            fetch(`/emails/${email_id}`, {
                method: 'PUT',
                body: JSON.stringify({ deleted: !email.deleted })
            }).then(() => load_mailbox('inbox'));
        };

        if (isTrash && document.querySelector('#btn-perm-delete')) {
            document.querySelector('#btn-perm-delete').onclick = () => {
                if (confirm("Delete this email forever? This cannot be undone.")) {
                    fetch(`/emails/${email_id}`, { method: 'DELETE' })
                    .then(() => load_mailbox('trash'));
                }
            };
        }
    });
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
