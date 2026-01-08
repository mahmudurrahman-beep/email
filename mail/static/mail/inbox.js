/**
 * static/mail/inbox.js
 * Full implementation with consistent full timestamps in detail view
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
    if (!document.querySelector('.sidebar')) document.body.classList.add('no-sidebar');
   
    initApp();
});
function initApp() {
    setupNavigation();
    setupComposeForm();
   
    load_mailbox('inbox');
    setActiveNav('inbox');
}
function setupNavigation() {
    document.querySelector('#compose-btn').onclick = () => compose_email();
    const mailboxes = ['inbox', 'sent', 'archived'];
    mailboxes.forEach(mb => {
        const el = document.querySelector(`#${mb}`);
        if (el) el.onclick = () => {
            const mbName = mb === 'archived' ? 'archive' : mb;
            load_mailbox(mbName);
            setActiveNav(mb);
        };
    });
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
    trashBtn.onclick = () => {
        load_mailbox('trash');
        setActiveNav('trash');
    };
}
function setupComposeForm() {
    const form = document.querySelector('#compose-form');
    if (form) {
        form.onsubmit = (event) => {
            event.preventDefault();
            send_email();
        };
    }
    const cancelBtn = document.querySelector('#cancel-compose');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            load_mailbox('inbox');
            setActiveNav('inbox');
        };
    }
}
function show_view(view) {
    document.querySelector('#emails-view').classList.toggle('hidden', view !== 'emails');
    document.querySelector('#compose-view').classList.toggle('hidden', view !== 'compose');
    document.querySelector('#email-view').classList.toggle('hidden', view !== 'email');
   
    if (view !== 'emails') {
        setActiveNav('');
    }
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
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
// List timestamp: smart (time only if today, date otherwise)
function formatTimestamp(ts) {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();

    if (isToday) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (isThisYear) {
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    } else {
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}
// Full timestamp for detail header and quoted sections: always date + time
function formatFullTimestamp(ts) {
    const date = new Date(ts);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}
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
            row.className = `email-row ${email.read ? 'read' : 'unread'}`;
           
            const userEmail = window.CURRENT_USER_EMAIL;
            const senderDisplay = email.sender === userEmail ? 'You' : email.sender;
            const recipientsDisplay = email.recipients.map(r => r === userEmail ? 'You' : r).join(', ');
            const senderLabel = (mailbox === 'sent') ? `To: ${recipientsDisplay}` : senderDisplay;

            let previewText = email.body.split('\n\nOn ')[0].replace(/\n/g, ' ').trim();
            if (previewText.length > 80) previewText = previewText.substring(0, 80) + '...';
            const preview = previewText ? previewText : '';

            row.innerHTML = `
                <div class="email-sender text-truncate">${escapeHtml(senderLabel)}</div>
                <div class="email-content">
                    <span class="email-subject">${escapeHtml(email.subject || '(no subject)')}</span>
                    ${preview ? `<span class="email-preview-separator">—</span><span class="email-preview">${escapeHtml(preview)}</span>` : ''}
                </div>
                <div class="email-timestamp">${formatTimestamp(email.timestamp)}</div>
            `;
            row.addEventListener('click', () => view_email(email.id, mailbox));
           
            list.append(row);
        });
       
        view.append(list);
    })
    .catch(err => {
        view.innerHTML = `<div class="error-state">${MESSAGES.load.failed(mailbox)}</div>`;
    });
}
function formatBody(body) {
    const lines = body.split('\n');
    let html = '';
    let inQuote = false;
    lines.forEach(line => {
        const match = line.match(/^On\s*(.+?)\s*,\s*(.+?)\s*wrote:\s*$/);
        if (match) {
            if (inQuote) html += '</div>';
            let rawTs = match[1].trim();
            let sender = match[2].trim();
            let formattedTs = rawTs;
            if (rawTs.includes('T') || rawTs.includes('+') || rawTs.includes('.')) {
                try {
                    const parsedDate = new Date(rawTs);
                    if (!isNaN(parsedDate)) {
                        formattedTs = formatFullTimestamp(parsedDate.toISOString());
                    }
                } catch (e) {}
            }
            const headerText = `On ${formattedTs}, ${sender} wrote:`;
            html += '<div class="quoted-block"><span class="quote-header">' + escapeHtml(headerText) + '</span><br>';
            inQuote = true;
        } else if (line.startsWith('> ')) {
            html += escapeHtml(line.substring(2)) + '<br>';
        } else {
            if (inQuote) {
                html += '</div>';
                inQuote = false;
            }
            html += escapeHtml(line) + '<br>';
        }
    });
    if (inQuote) html += '</div>';
    return html;
}
function view_email(id, mailbox) {
    show_view('email');
    const view = document.querySelector('#email-view');
    view.innerHTML = `<div class="loading"><div class="spinner"></div><p>Loading email...</p></div>`;
    fetch(`/emails/${id}`)
    .then(response => response.json())
    .then(email => {
        view.innerHTML = '';
        updateToolbarTitle(escapeHtml(email.subject || 'Email'));
        const toolbar = document.createElement('div');
        toolbar.className = 'email-detail-toolbar';
        const actions = document.createElement('div');
        actions.className = 'actions-group';
        if (mailbox !== 'sent' && mailbox !== 'trash') {
            const markBtn = document.createElement('button');
            markBtn.className = 'btn-action';
            markBtn.innerText = email.read ? 'Mark unread' : 'Mark read';
            markBtn.onclick = () => toggle_read(email.id, email.read, mailbox);
            actions.appendChild(markBtn);
        }
        const replyBtn = document.createElement('button');
        replyBtn.className = 'btn-action btn-reply';
        replyBtn.innerText = 'Reply';
        replyBtn.onclick = () => reply_email(email);
        actions.appendChild(replyBtn);
        if (mailbox !== 'trash') {
            const archiveBtn = document.createElement('button');
            archiveBtn.className = 'btn-action';
            archiveBtn.innerText = email.archived ? 'Unarchive' : 'Archive';
            archiveBtn.onclick = () => toggle_archive(email.id, email.archived, mailbox);
            actions.appendChild(archiveBtn);
        }
        if (mailbox !== 'trash') {
            const trashBtn = document.createElement('button');
            trashBtn.className = 'btn-action btn-danger';
            trashBtn.innerText = 'Trash';
            trashBtn.onclick = () => move_to_trash(email.id, mailbox);
            actions.appendChild(trashBtn);
        } else {
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'btn-action';
            restoreBtn.innerText = 'Restore';
            restoreBtn.onclick = () => restore_from_trash(email.id);
            actions.appendChild(restoreBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-action btn-perm';
            deleteBtn.innerText = 'Delete Forever';
            deleteBtn.onclick = () => perm_delete(email.id);
            actions.appendChild(deleteBtn);
        }
        toolbar.appendChild(actions);
        view.appendChild(toolbar);
        const userEmail = window.CURRENT_USER_EMAIL;
        const senderDisplay = email.sender === userEmail ? 'You' : email.sender;
        const recipientsDisplay = email.recipients.map(r => r === userEmail ? 'You' : r).join(', ');
        const header = document.createElement('div');
        header.className = 'email-header-card';
        header.innerHTML = `
            <div class="email-header-row">
                <span class="header-label">From:</span>
                <span>${escapeHtml(senderDisplay)}</span>
            </div>
            <div class="email-header-row">
                <span class="header-label">To:</span>
                <span>${escapeHtml(recipientsDisplay)}</span>
            </div>
            <div class="email-header-row">
                <span class="header-label">Subject:</span>
                <span>${escapeHtml(email.subject || '(no subject)')}</span>
            </div>
            <div class="email-header-row">
                <span class="header-label">Timestamp:</span>
                <span>${formatFullTimestamp(email.timestamp)}</span>
            </div>
        `;
        view.appendChild(header);
        const bodyEl = document.createElement('div');
        bodyEl.className = 'email-body-content';
        bodyEl.innerHTML = formatBody(email.body);
        view.appendChild(bodyEl);
        if (!email.read && mailbox !== 'sent' && mailbox !== 'trash') {
            fetch(`/emails/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ read: true })
            });
        }
    })
    .catch(err => {
        view.innerHTML = `<div class="error-state">Failed to load email.</div>`;
    });
}
function toggle_read(id, read, mailbox) {
    fetch(`/emails/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ read: !read })
    })
    .then(() => {
        view_email(id, mailbox);
        showNotification(MESSAGES.mark[!read ? 'read' : 'unread'], 'success');
    })
    .catch(() => showNotification(MESSAGES.archive.failed, 'error'));
}
function reply_email(email) {
    let subject = email.subject;
    if (!subject.startsWith('Re: ')) {
        subject = `Re: ${subject}`;
    }
    let body = `\n\nOn ${formatFullTimestamp(email.timestamp)}, ${email.sender} wrote:\n${email.body.split('\n').map(line => `> ${line}`).join('\n')}`;
    compose_email({
        recipients: email.sender,
        subject: subject,
        body: body
    });
}
function toggle_archive(id, archived, mailbox) {
    fetch(`/emails/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ archived: !archived })
    })
    .then(() => {
        load_mailbox(archived ? 'archive' : 'inbox');
        setActiveNav(archived ? 'archived' : 'inbox');
        showNotification(MESSAGES.archive[archived ? 'unarchived' : 'archived'], 'success');
    })
    .catch(() => showNotification(MESSAGES.archive.failed, 'error'));
}
function move_to_trash(id, mailbox) {
    fetch(`/emails/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ deleted: true })
    })
    .then(() => {
        load_mailbox(mailbox);
        const navId = mailbox === 'archive' ? 'archived' : mailbox;
        setActiveNav(navId);
        showNotification(MESSAGES.trash.moved, 'success');
    })
    .catch(() => showNotification(MESSAGES.archive.failed, 'error'));
}
function restore_from_trash(id) {
    fetch(`/emails/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ deleted: false })
    })
    .then(() => {
        load_mailbox('trash');
        setActiveNav('trash');
        showNotification(MESSAGES.trash.restored, 'success');
    })
    .catch(() => showNotification(MESSAGES.archive.failed, 'error'));
}
function perm_delete(id) {
    if (confirm('Permanently delete this email? This action cannot be undone.')) {
        fetch(`/emails/${id}`, {
            method: 'DELETE'
        })
        .then(() => {
            load_mailbox('trash');
            setActiveNav('trash');
            showNotification(MESSAGES.trash.permDeleted, 'success');
        })
        .catch(() => showNotification(MESSAGES.archive.failed, 'error'));
    }
}
function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerText = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}
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
