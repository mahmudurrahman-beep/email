// static/mail/inbox.js

const MESSAGES = {
    send: { sending: 'Sending...', sent: 'Email sent.', failed: 'Failed to send email.' },
    validation: { noRecipient: 'Please enter at least one recipient.' },
    load: { loading: (mb) => `Loading ${mb}...`, failed: (mb) => `Failed to load ${mb}.` },
    archive: { archived: 'Archived', unarchived: 'Moved to Inbox', failed: 'Update failed' },
    trash: { moved: 'Moved to Trash', restored: 'Restored', permDeleted: 'Deleted permanently' },
    compose: { newEmail: 'New Email' }
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupNavigation();
    setupComposeForm();
    load_mailbox('inbox');
}

function setupNavigation() {
    document.querySelector('#compose-btn').onclick = () => compose_email();
    document.querySelector('#inbox').onclick = () => load_mailbox('inbox');
    document.querySelector('#sent').onclick = () => load_mailbox('sent');
    document.querySelector('#archived').onclick = () => load_mailbox('archive');
    document.querySelector('#trash').onclick = () => load_mailbox('trash');
    
    const cancelBtn = document.querySelector('#cancel-compose');
    if (cancelBtn) cancelBtn.onclick = () => load_mailbox('inbox');
}

function setupComposeForm() {
    document.querySelector('#compose-form').onsubmit = send_email;
}

function show_view(view) {
    document.querySelector('#emails-view').style.display = (view === 'emails') ? 'block' : 'none';
    document.querySelector('#compose-view').style.display = (view === 'compose') ? 'block' : 'none';
    document.querySelector('#email-view').style.display = (view === 'email') ? 'block' : 'none';
}

function load_mailbox(mailbox) {
    show_view('emails');
    const view = document.querySelector('#emails-view');
    document.querySelector('#mailbox-title').textContent = mailbox.charAt(0).toUpperCase() + mailbox.slice(1);
    
    view.innerHTML = `<div class="loading">${MESSAGES.load.loading(mailbox)}</div>`;

    fetch(`/emails/${mailbox}`)
    .then(response => response.json())
    .then(emails => {
        view.innerHTML = '';
        if (emails.length === 0) {
            view.innerHTML = `<div class="empty-state">No messages in ${mailbox}.</div>`;
            return;
        }

        emails.forEach(email => {
            const element = document.createElement('div');
            // Use the CSS classes from your styles.css
            element.className = `email-row ${email.read ? 'read' : 'unread'}`;
            
            // LOGIC: Show "To: ..." if in Sent box, else show Sender
            const displayUser = mailbox === 'sent' 
                ? `To: ${email.recipients.join(", ")}` 
                : email.sender;

            element.innerHTML = `
                <div class="email-sender">${displayUser}</div>
                <div class="email-content">
                    <span class="email-subject">${email.subject}</span>
                    <span class="email-preview"> - ${email.body.substring(0, 50)}...</span>
                </div>
                <div class="email-timestamp">${email.timestamp}</div>
            `;
            
            // FIX: The click listener that makes it clickable
            element.addEventListener('click', () => view_email(email.id, mailbox));
            view.append(element);
        });
    });
}

function view_email(id, mailbox) {
    show_view('email');
    const view = document.querySelector('#email-view');
    view.innerHTML = '';

    fetch(`/emails/${id}`)
    .then(response => response.json())
    .then(email => {
        // Mark as read
        if (!email.read) {
            fetch(`/emails/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ read: true })
            });
        }

        const container = document.createElement('div');
        container.className = 'email-detail';
        
        // Action Buttons Logic
        let archiveBtnText = email.archived ? "Unarchive" : "Archive";
        let trashBtnText = mailbox === 'trash' ? "Restore" : "Trash";

        container.innerHTML = `
            <div class="email-detail-header">
                <div>
                    <button class="btn-action" id="back-btn">← Back</button>
                    <button class="btn-action btn-reply" id="reply-btn">Reply</button>
                    <button class="btn-action" id="archive-btn">${archiveBtnText}</button>
                    <button class="btn-action" style="color:red" id="trash-btn">${trashBtnText}</button>
                    ${mailbox === 'trash' ? '<button class="btn-action" style="color:darkred" id="perm-delete">Delete Forever</button>' : ''}
                </div>
            </div>
            <div class="email-header">
                <div class="email-header-row"><span class="header-label">From:</span> ${email.sender}</div>
                <div class="email-header-row"><span class="header-label">To:</span> ${email.recipients.join(", ")}</div>
                <div class="email-header-row"><span class="header-label">Subject:</span> ${email.subject}</div>
                <div class="email-header-row"><span class="header-label">Date:</span> ${email.timestamp}</div>
            </div>
            <div class="email-body">${email.body}</div>
        `;

        view.appendChild(container);

        // Button Listeners
        document.querySelector('#back-btn').onclick = () => load_mailbox(mailbox);
        
        document.querySelector('#reply-btn').onclick = () => {
            compose_email({
                recipients: email.sender,
                subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
                body: `\n\n--- On ${email.timestamp} ${email.sender} wrote: \n${email.body}`
            });
        };

        document.querySelector('#archive-btn').onclick = () => {
            fetch(`/emails/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ archived: !email.archived })
            }).then(() => load_mailbox('inbox'));
        };

        document.querySelector('#trash-btn').onclick = () => {
            fetch(`/emails/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ deleted: mailbox !== 'trash' })
            }).then(() => load_mailbox('inbox'));
        };

        if (mailbox === 'trash') {
            document.querySelector('#perm-delete').onclick = () => {
                if (confirm("Permanently delete this email?")) {
                    fetch(`/emails/${id}`, { method: 'DELETE' })
                    .then(() => load_mailbox('trash'));
                }
            };
        }
    });
}

function compose_email(prefill = {}) {
    show_view('compose');
    document.querySelector('#compose-recipients').value = prefill.recipients || '';
    document.querySelector('#compose-subject').value = prefill.subject || '';
    document.querySelector('#compose-body').value = prefill.body || '';
}

function send_email(e) {
    e.preventDefault();
    fetch('/emails', {
        method: 'POST',
        body: JSON.stringify({
            recipients: document.querySelector('#compose-recipients').value,
            subject: document.querySelector('#compose-subject').value,
            body: document.querySelector('#compose-body').value
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.error) {
            alert(result.error);
        } else {
            load_mailbox('sent');
        }
    });
}
