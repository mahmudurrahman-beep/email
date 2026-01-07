// inbox.js - inbox client with archive guard for Sent and Trash feature-detection
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
  if (composeBtn) composeBtn.addEventListener('click', () => { compose_email(); setActiveNav(null); });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function () {
      const mailbox = this.id === 'archived' ? 'archive' : this.id;
      load_mailbox(mailbox);
      setActiveNav(this.id);
    });
  });

  // Add Trash nav item dynamically if not present (will be hidden if unsupported)
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
      div.addEventListener('click', () => { load_mailbox('trash'); setActiveNav('trash'); });
    }
  }

  const cancelBtn = document.querySelector('#cancel-compose');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { load_mailbox('inbox'); setActiveNav('inbox'); });
}

function setupComposeForm() {
  const form = document.querySelector('#compose-form');
  if (form) form.addEventListener('submit', send_email);
}

/* Ensure email-view exists */
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
    updateToolbarTitle('New Email');
    document.body.classList.add('compose-active');
  } else if (view === 'email' && emailView) {
    emailView.classList.remove('hidden');
  }
}

function setActiveNav(activeId) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  // Manage body class for trash view so CSS can hide/show buttons
  document.body.classList.remove('trash-view');
  if (activeId) {
    const el = document.querySelector(`#${activeId}`);
    if (el) el.classList.add('active');
    // Add trash-view class when Trash is active
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

  if (!recipients.trim()) { show_notification('Please enter at least one recipient.', 'error'); return; }

  show_notification('Sending...', 'info');

  fetch('/emails', {
    method: 'POST',
    body: JSON.stringify({ recipients: recipients.trim(), subject: subject.trim(), body: body.trim() })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) show_notification(data.error, 'error');
      else { show_notification('Email sent.', 'success'); load_mailbox('sent'); setActiveNav('sent'); }
    })
    .catch(() => show_notification('Failed to send email.', 'error'));
}

/* Load mailbox */
function load_mailbox(mailbox) {
  show_view('emails');
  const view = document.querySelector('#emails-view');
  if (!view) return;
  view.innerHTML = '';
  const loading = document.createElement('div');
  loading.className = 'loading-state';
  loading.innerHTML = `<div class="spinner"></div><p>Loading ${escapeHtml(capitalize(mailbox))}...</p>`;
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
      view.innerHTML = `<div class="error-state"><p>Failed to load ${escapeHtml(capitalize(mailbox))}.</p></div>`;
    });
}

function createEmailElement(email, mailbox) {
  const div = document.createElement('div');
  div.className = 'email-item ' + (email.read ? 'read' : 'unread');
  div.setAttribute('data-id', email.id);

  const previewText = getReplyOnlyPreview(email.body || '');
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

/* Keep only the user's reply, drop the quoted part starting at "On ... wrote:" */
function getReplyOnlyPreview(body) {
  const lines = String(body).split('\n');
  const idx = lines.findIndex(l => /^On .+ wrote:$/i.test(l.trim()));
  const replyLines = idx >= 0 ? lines.slice(0, idx) : lines;
  const reply = replyLines.join(' ').replace(/\s+/g, ' ').trim(); // compact spaces for preview
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

/* View single email with header + action bar */
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
        // optimistic update in list
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

  // Determine whether the current client user is the owner of this Email row
  const currentUserEmail = window.CURRENT_USER_EMAIL || null;
  const isOwner = currentUserEmail && currentUserEmail === email.user;

  const header = document.createElement('div');
  header.className = 'email-detail-header';
  header.innerHTML = `
    <div style="flex:1;min-width:0">
      <div class="email-subject" style="font-size:18px;font-weight:700;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${escapeHtml(email.subject || '(no subject)')}
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

  // Split body: reply vs quoted block
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

  // Actions wiring
  const replyBtn = document.getElementById('reply-btn');
  if (replyBtn) replyBtn.addEventListener('click', () => replyToEmailFromView(email.id));

  const archiveBtn = document.getElementById('archive-btn');
  if (archiveBtn) {
    // Archive/unarchive should work for both sent and received copies.
    archiveBtn.addEventListener('click', () => {
      const newArchived = !email.archived;
      updateEmail(email.id, { archived: newArchived })
        .then(() => {
          // Choose message and destination based on whether the current user owns this Email row
          if (newArchived) {
            show_notification('Archived', 'success');
            load_mailbox('archive');
            setActiveNav('archived');
          } else {
            // Unarchived: go back to Inbox if recipient, Sent if owner is sender
            if (isOwner && email.sender === currentUserEmail) {
              show_notification('Moved to Sent', 'success');
              load_mailbox('sent');
              setActiveNav('sent');
            } else {
              show_notification('Moved to Inbox', 'success');
              load_mailbox('inbox');
              setActiveNav('inbox');
            }
          }
        })
        .catch(() => show_notification('Update failed', 'error'));
    });
  }

  // Delete / Restore logic
  const deleteBtn = document.getElementById('delete-btn');
  // If viewing Trash mailbox, show Restore button next to Delete Permanently
  if (currentMailbox === 'trash') {
    // Ensure delete button shows "Delete Permanently"
    if (deleteBtn) deleteBtn.textContent = 'Delete Permanently';

    // Create Restore button and insert before delete button
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn-action';
    restoreBtn.id = 'restore-btn';
    restoreBtn.textContent = 'Restore';
    // Insert restore button into actions container
    const actionsContainer = header.querySelector('.email-actions');
    if (actionsContainer) actionsContainer.insertBefore(restoreBtn, deleteBtn);

    // Wire restore action
    restoreBtn.addEventListener('click', () => {
      updateEmail(email.id, { deleted: false })
        .then(() => {
          // If the current user owns the row and is the sender, restore to Sent; otherwise restore to Inbox
          if (isOwner && email.sender === currentUserEmail) {
            show_notification('Restored to Sent', 'success');
            load_mailbox('sent');
            setActiveNav('sent');
          } else {
            show_notification('Restored to Inbox', 'success');
            load_mailbox('inbox');
            setActiveNav('inbox');
          }
        })
        .catch(() => show_notification('Restore failed', 'error'));
    });

    // Wire permanent delete (confirm)
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (!confirm('Permanently delete this message? This cannot be undone.')) return;
        fetch(`/emails/${email.id}`, { method: 'DELETE' })
          .then(res => { if (res.ok) { show_notification('Permanently deleted', 'success'); load_mailbox('trash'); setActiveNav('trash'); } else { show_notification('Permanent delete failed', 'error'); } })
          .catch(() => show_notification('Permanent delete failed', 'error'));
      });
    }
  } else {
    // Normal inbox/archive/sent behavior: move to trash or permanent delete if already deleted
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (!SUPPORTS_TRASH) { show_notification('Delete not supported by server', 'error'); return; }
        if (!email.deleted) {
          updateEmail(email.id, { deleted: true })
            .then(() => {
              showUndoToast('Moved to Trash', () => updateEmail(email.id, { deleted: false }).then(() => { show_notification('Restored', 'success'); load_mailbox('inbox'); setActiveNav('inbox'); }));
              load_mailbox('inbox'); setActiveNav('inbox');
            })
            .catch(() => show_notification('Failed to move to Trash', 'error'));
        } else {
          if (!confirm('Permanently delete this message? This cannot be undone.')) return;
          fetch(`/emails/${email.id}`, { method: 'DELETE' })
            .then(res => { if (res.ok) { show_notification('Permanently deleted', 'success'); load_mailbox('trash'); setActiveNav('trash'); } else { show_notification('Permanent delete failed', 'error'); } })
            .catch(() => show_notification('Permanent delete failed', 'error'));
        }
      });
    }
  }

  const markBtn = document.getElementById('mark-btn');
  if (markBtn) markBtn.addEventListener('click', () => {
    updateEmail(email.id, { read: !email.read })
      .then(() => { show_notification(email.read ? 'Marked unread' : 'Marked read', 'success'); load_mailbox(currentMailbox || 'inbox'); setActiveNav(currentMailbox || 'inbox'); })
      .catch(() => show_notification('Failed to update read state', 'error'));
  });
}

/* Parse the body into reply text + quoted lines starting with "On ... wrote:" */
function splitReplyAndQuote(body) {
  const lines = String(body).split('\n');
  const idx = lines.findIndex(l => /^On .+ wrote:$/i.test(l.trim()));
  if (idx >= 0) {
    const replyLines = lines.slice(0, idx);
    const quoteLines = lines.slice(idx); // include the marker and everything after
    return {
      replyText: replyLines.join('\n').trim(),
      quotedLines: quoteLines
    };
  }
  return { replyText: body.trim(), quotedLines: [] };
}

/* Helpers for update actions */
function updateEmail(id, payload) {
  return fetch(`/emails/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }).then(res => {
    if (!res.ok) throw new Error('Update failed');
    return res;
  });
}

/* Utilities: archive toggle wrapper */
function toggleArchive(id, currentlyArchived) {
  updateEmail(id, { archived: !currentlyArchived })
    .then(() => {
      show_notification(currentlyArchived ? 'Moved to Inbox' : 'Archived', 'success');
      load_mailbox('inbox');
      setActiveNav('inbox');
    })
    .catch(() => show_notification('Update failed', 'error'));
}

/* Notifications */
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

/* Undo toast helper */
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

/* Reply helper */
function replyToEmailFromView(id) {
  fetch(`/emails/${id}`)
    .then(res => res.json())
    .then(email => {
      let subj = email.subject || '';
      if (!/^Re:/i.test(subj)) subj = `Re: ${subj}`;
      // Plaintext quoted block (no HTML)
      const quoted = [
        '',
        '',
        `On ${formatTimestamp(email.timestamp)} ${email.sender} wrote:`,
        ...(email.body || '').split('\n')
      ].join('\n');
      compose_email({ recipients: email.sender, subject: subj, body: quoted });
    })
    .catch(() => show_notification('Failed to load email for reply', 'error'));
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
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function capitalize(s) { if (!s) return ''; return s.charAt(0).toUpperCase() + s.slice(1); }
