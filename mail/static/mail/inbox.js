// static/mail/inbox.js
// Full client script (integrated with backend serialize fields)

const MESSAGES = {
  send: { sending: 'Sending...', sent: 'Email sent.', failed: 'Failed to send email.' },
  validation: { noRecipient: 'Please enter at least one recipient.' },
  load: { loading: (mb) => `Loading ${mb}...`, failed: (mb) => `Failed to load ${mb}.` },
  archive: { archived: 'Archived (your copy)', unarchivedInbox: 'Moved to Inbox (your copy)', unarchivedSent: 'Moved to Sent (your copy)', failed: 'Update failed' },
  trash: { notSupported: 'Delete not supported by server', moved: 'Moved to Trash (your copy)', restored: 'Restored (your copy)', failedMove: 'Failed to move to Trash', permDeleted: 'Permanently deleted', permFailed: 'Permanent delete failed' },
  restore: { toArchive: 'Restored to Archive (your copy)', toSent: 'Restored to Sent (your copy)', toInbox: 'Restored to Inbox (your copy)', failed: 'Restore failed' },
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

function setupNavigation() {
  const composeBtn = document.querySelector('#compose-btn') || document.querySelector('.compose-btn');
  if (composeBtn) composeBtn.addEventListener('click', () => { compose_email(); setActiveNav(null); });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function () {
      const mailbox = this.id === 'archived' ? 'archive' : this.id;
      load_mailbox(mailbox);
      setActiveNav(this.id);
    });
  });

  const cancelBtn = document.querySelector('#cancel-compose');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { load_mailbox('inbox'); setActiveNav('inbox'); });
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
    updateToolbarTitle(activeId === 'archived' ? 'Archive' : activeId.charAt(0).toUpperCase() + activeId.slice(1));
  } else {
    updateToolbarTitle('');
  }
}

function updateToolbarTitle(text) {
  const title = document.querySelector('.content-toolbar h2') || document.querySelector('#mailbox-title');
  if (title) title.textContent = text;
}

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

function send_email(event) {
  event.preventDefault();
  const recipients = (document.querySelector('#compose-recipients') || {}).value || '';
  const subject = (document.querySelector('#compose-subject') || {}).value || '';
  const body = (document.querySelector('#compose-body') || {}).value || '';

  if (!recipients.trim()) { show_notification(MESSAGES.validation.noRecipient, 'error'); return; }

  show_notification(MESSAGES.send.sending, 'info');

  fetch('/emails', {
    method: 'POST',
    body: JSON.stringify({ recipients: recipients.trim(), subject: subject.trim(), body: body.trim() })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) show_notification(data.error, 'error');
      else { show_notification(MESSAGES.send.sent, 'success'); load_mailbox('sent'); setActiveNav('sent'); }
    })
    .catch(() => show_notification(MESSAGES.send.failed, 'error'));
}

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
      if (!Array.isArray(emails) || emails.length === 0) { showEmptyState(mailbox, view); return; }
      const list = document.createElement('div'); list.className = 'emails-list';
      emails.forEach(email => list.appendChild(createEmailElement(email, mailbox)));
      view.appendChild(list);
    })
    .catch(() => {
      view.innerHTML = `<div class="error-state"><p>${escapeHtml(MESSAGES.load.failed(capitalize(mailbox)))}</p></div>`;
    });
}

/* --- Key change: createEmailElement renders From for inbox and To for sent --- */
function createEmailElement(email, mailbox) {
  const div = document.createElement('div');
  div.className = 'email-item ' + (email.read ? 'read' : 'unread');
  div.setAttribute('data-id', email.id);

  const previewText = getReplyOnlyPreview(email.body || '');
  const ts = formatTimestamp(email.timestamp);

  const currentUser = window.CURRENT_USER_EMAIL || null;
  const isOwner = !!email.is_owner || (currentUser && currentUser === email.user);
  const ownerBadge = isOwner ? ' <span class="owner-badge">(You)</span>' : '';

  // Prefer sender_email (readable), fallback to sender string
  const senderDisplay = email.sender_email || email.sender || '(unknown)';
  const recipientsDisplay = (email.recipient_emails && email.recipient_emails.length) ? email.recipient_emails.join(', ') : '(no recipients)';

  let leftHtml;
  if (mailbox === 'sent') {
    leftHtml = `<div class="email-sender">To: ${escapeHtml(recipientsDisplay)}${ownerBadge}</div>`;
  } else {
    leftHtml = `<div class="email-sender">From: ${escapeHtml(senderDisplay)}${ownerBadge}</div>`;
  }

  div.innerHTML = `
    ${leftHtml}
    <div class="email-content">
      <div class="email-subject">${escapeHtml(email.subject || '(no subject)')}</div>
      <div class="email-preview">${escapeHtml(previewText.substring(0, 120))}${previewText.length > 120 ? '...' : ''}</div>
    </div>
    <div class="email-timestamp">${escapeHtml(ts)}</div>
  `;
  div.addEventListener('click', () => view_email(email.id, mailbox));
  return div;
}

function getReplyOnlyPreview(body) {
  const lines = String(body).split('\n');
  const idx = lines.findIndex(l => /^On .+ wrote:$/i.test(l.trim()));
  const replyLines = idx >= 0 ? lines.slice(0, idx) : lines;
  const reply = replyLines.join(' ').replace(/\s+/g, ' ').trim();
  return reply || body.substring(0, 140);
}

function showEmptyState(mailbox, container) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  let msg = 'No emails';
  if (mailbox === 'inbox') msg = 'Your inbox is empty';
  if (mailbox === 'sent') msg = 'No sent emails yet';
  if (mailbox === 'archive') msg = 'No archived emails';
  if (mailbox === 'trash') msg = 'Trash is empty';
  empty.innerHTML = `<h3>${escapeHtml(msg)}</h3><p>${mailbox === 'inbox' ? 'Emails you receive will appear here.' : ''}</p>`;
  container.appendChild(empty);
}

/* --- View single email and actions (uses is_owner and previous_mailbox) --- */
function view_email(email_id, currentMailbox = null) {
  show_view('email');
  const view = document.querySelector('#email-view');
  if (!view) return;
  view.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading email...</p></div>`;

  fetch(`/emails/${email_id}`)
    .then(res => {
      if (!res.ok) return res.json().then(d => { throw new Error(d.error || 'Email not found'); });
      return res.json();
    })
    .then(email => {
      if (!email.read) {
        updateEmail(email.id, { read: true }).catch(()=>{});
        const item = document.querySelector(`.email-item[data-id="${email.id}"]`);
        if (item) { item.classList.remove('unread'); item.classList.add('read'); }
      }
      renderEmailView(email, view, currentMailbox);
    })
    .catch(err => {
      view.innerHTML = `<div class="error-state"><p>${escapeHtml(err.message)}</p><button class="btn-action btn-back" onclick="load_mailbox('inbox'); setActiveNav('inbox');">Back</button></div>`;
    });
}

function renderEmailView(email, container, currentMailbox) {
  container.innerHTML = '';

  const currentUserEmail = window.CURRENT_USER_EMAIL || null;
  const isOwner = !!email.is_owner || (currentUserEmail && currentUserEmail === email.user);

  const header = document.createElement('div');
  header.className = 'email-detail-header';

  const original = email.previous_mailbox ? `Original: ${capitalize(email.previous_mailbox)}` : (email.archived ? 'Original: Archive' : (isOwner && email.sender === currentUserEmail ? 'Original: Sent' : 'Original: Inbox'));
  const ownerLabel = isOwner ? 'You' : (email.user || '(owner)');

  header.innerHTML = `
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
        <div class="email-subject" style="font-size:18px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(email.subject || '(no subject)')}</div>
        <div class="meta-badges" style="font-size:12px;color:var(--text-medium)">${escapeHtml(ownerLabel)} · ${escapeHtml(original)}</div>
      </div>
      <div style="color:var(--text-medium);font-size:14px">
        <div><strong>From:</strong> ${escapeHtml(email.sender)}</div>
        <div><strong>To:</strong> ${escapeHtml((email.recipients || []).join(', '))}</div>
      </div>
    </div>
    <div style="text-align:right;min-width:160px">
      <div class="email-timestamp" title="${escapeHtml(email.timestamp)}">${escapeHtml(formatTimestamp(email.timestamp))}</div>
      <div class="email-actions" style="margin-top:8px">
        <button class="btn-action btn-reply" id="reply-btn">Reply</button>
        <button class="btn-action" id="archive-btn">${email.archived ? 'Unarchive' : 'Archive'}</button>
        <button class="btn-action" id="delete-btn">${email.deleted ? 'Delete Permanently' : 'Delete'}</button>
        <button class="btn-action" id="mark-btn">${email.read ? 'Mark Unread' : 'Mark Read'}</button>
      </div>
    </div>
  `;

  const { replyText, quotedLines } = splitReplyAndQuote(email.body || '');
  const body = document.createElement('div');
  body.className = 'email-body';
  const replyEl = document.createElement('div');
  replyEl.className = 'reply-text';
  replyEl.textContent = replyText;
  body.appendChild(replyEl);
  if (quotedLines.length) {
    const quoteEl = document.createElement('div');
    quoteEl.className = 'quoted-block';
    quoteEl.textContent = quotedLines.join('\n');
    body.appendChild(quoteEl);
  }

  container.appendChild(header);
  container.appendChild(body);

  const replyBtn = document.getElementById('reply-btn');
  if (replyBtn) replyBtn.addEventListener('click', () => replyToEmailFromView(email.id));

  const archiveBtn = document.getElementById('archive-btn');
  if (archiveBtn) {
    archiveBtn.addEventListener('click', () => {
      const newArchived = !email.archived;
      updateEmail(email.id, { archived: newArchived })
        .then(() => {
          if (newArchived) {
            show_notification(MESSAGES.archive.archived, 'success');
            load_mailbox('archive');
            setActiveNav('archived');
          } else {
            if (isOwner && email.sender === currentUserEmail) {
              show_notification(MESSAGES.archive.unarchivedSent, 'success');
              load_mailbox('sent');
              setActiveNav('sent');
            } else {
              show_notification(MESSAGES.archive.unarchivedInbox, 'success');
              load_mailbox('inbox');
              setActiveNav('inbox');
            }
          }
        })
        .catch(() => show_notification(MESSAGES.archive.failed, 'error'));
    });
  }

  const deleteBtn = document.getElementById('delete-btn');
  if (currentMailbox === 'trash') {
    if (deleteBtn) deleteBtn.textContent = 'Delete Permanently';
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn-action';
    restoreBtn.id = 'restore-btn';
    restoreBtn.textContent = 'Restore';
    const actionsContainer = header.querySelector('.email-actions');
    if (actionsContainer) actionsContainer.insertBefore(restoreBtn, deleteBtn);

    restoreBtn.addEventListener('click', () => {
      const dest = email.previous_mailbox || (email.archived ? 'archive' : (isOwner && email.sender === currentUserEmail ? 'sent' : 'inbox'));
      updateEmail(email.id, { deleted: false })
        .then(() => {
          if (dest === 'archive') { show_notification(MESSAGES.restore.toArchive, 'success'); load_mailbox('archive'); setActiveNav('archived'); }
          else if (dest === 'sent') { show_notification(MESSAGES.restore.toSent, 'success'); load_mailbox('sent'); setActiveNav('sent'); }
          else { show_notification(MESSAGES.restore.toInbox, 'success'); load_mailbox('inbox'); setActiveNav('inbox'); }
        })
        .catch(() => show_notification(MESSAGES.restore.failed, 'error'));
    });

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (!confirm(MESSAGES.confirm.permDelete)) return;
        fetch(`/emails/${email.id}`, { method: 'DELETE' })
          .then(res => { if (res.ok) { show_notification(MESSAGES.trash.permDeleted, 'success'); load_mailbox('trash'); setActiveNav('trash'); } else { show_notification(MESSAGES.trash.permFailed, 'error'); } })
          .catch(() => show_notification(MESSAGES.trash.permFailed, 'error'));
      });
    }
  } else {
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (!SUPPORTS_TRASH) { show_notification(MESSAGES.trash.notSupported, 'error'); return; }
        if (!email.deleted) {
          updateEmail(email.id, { deleted: true })
            .then(() => {
              showUndoToast(MESSAGES.trash.moved, () => updateEmail(email.id, { deleted: false }).then(() => { show_notification(MESSAGES.trash.restored, 'success'); load_mailbox('inbox'); setActiveNav('inbox'); }));
              load_mailbox('inbox'); setActiveNav('inbox');
            })
            .catch(() => show_notification(MESSAGES.trash.failedMove, 'error'));
        } else {
          if (!confirm(MESSAGES.confirm.permDelete)) return;
          fetch(`/emails/${email.id}`, { method: 'DELETE' })
            .then(res => { if (res.ok) { show_notification(MESSAGES.trash.permDeleted, 'success'); load_mailbox('trash'); setActiveNav('trash'); } else { show_notification(MESSAGES.trash.permFailed, 'error'); } })
            .catch(() => show_notification(MESSAGES.trash.permFailed, 'error'));
        }
      });
    }
  }

  const markBtn = document.getElementById('mark-btn');
  if (markBtn) markBtn.addEventListener('click', () => {
    updateEmail(email.id, { read: !email.read })
      .then(() => { show_notification(email.read ? MESSAGES.mark.unread : MESSAGES.mark.read, 'success'); load_mailbox(currentMailbox || 'inbox'); setActiveNav(currentMailbox || 'inbox'); })
      .catch(() => show_notification(MESSAGES.mark.failed, 'error'));
  });
}

/* Helpers */
function splitReplyAndQuote(body) {
  const lines = String(body).split('\n');
  const idx = lines.findIndex(l => /^On .+ wrote:$/i.test(l.trim()));
  if (idx >= 0) {
    const replyLines = lines.slice(0, idx);
    const quoteLines = lines.slice(idx);
    return { replyText: replyLines.join('\n').trim(), quotedLines: quoteLines };
  }
  return { replyText: body.trim(), quotedLines: [] };
}

function updateEmail(id, payload) {
  return fetch(`/emails/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }).then(res => {
    if (!res.ok) throw new Error('Update failed');
    return res;
  });
}

function show_notification(message, type = 'info') {
  const existing = document.querySelector('.notification'); if (existing) existing.remove();
  const n = document.createElement('div'); n.className = `notification ${type}`;
  const icon = type === 'success' ? 'OK' : type === 'error' ? 'ERR' : 'INFO';
  n.innerHTML = `<span class="notification-icon">${icon}</span><span class="notification-message">${escapeHtml(message)}</span>`;
  n.setAttribute('role', 'status');
  n.setAttribute('aria-live', 'polite');
  document.body.appendChild(n);
  setTimeout(() => { if (n.parentNode) { n.style.opacity = '0'; n.style.transform = 'translateX(100%)'; setTimeout(() => n.remove(), 300); } }, 4000);
}

function showUndoToast(message, undoCallback, timeout = 5000) {
  const existing = document.querySelector('.undo-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'undo-toast';
  t.innerHTML = `<span class="notification-message">${escapeHtml(message)}</span><button class="btn-action">Undo</button>`;
  const btn = t.querySelector('button');
  btn.addEventListener('click', () => {
    if (typeof undoCallback === 'function') undoCallback();
    t.remove();
  });
  document.body.appendChild(t);
  setTimeout(() => { if (t.parentNode) t.remove(); }, timeout);
}

function replyToEmailFromView(id) {
  fetch(`/emails/${id}`)
    .then(res => res.json())
    .then(email => {
      let subj = email.subject || '';
      if (!/^Re:/i.test(subj)) subj = `Re: ${subj}`;
      const quoted = [
        '',
        '',
        `On ${formatTimestamp(email.timestamp)} ${email.sender} wrote:`,
        ...(email.body || '').split('\n')
      ].join('\n');
      compose_email({ recipients: email.sender, subject: subj, body: quoted });
    })
    .catch(() => show_notification(MESSAGES.send.failed, 'error'));
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const opts = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
  return d.toLocaleString('en-US', opts);
}
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function capitalize(s) { if (!s) return ''; return s.charAt(0).toUpperCase() + s.slice(1); }
