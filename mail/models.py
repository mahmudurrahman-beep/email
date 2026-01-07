# mail/models.py
from django.db import models
from django.conf import settings

class Email(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)  # owner of this copy
    # store sender as string (email or display name) for readability
    sender = models.CharField(max_length=255)
    recipients = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='received_emails', blank=True)
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)
    deleted = models.BooleanField(default=False)
    previous_mailbox = models.CharField(max_length=32, blank=True, null=True)

    def __str__(self):
        return f"{self.subject or '(no subject)'} ({self.id})"

    def sender_email(self):
        s = (self.sender or "").strip()
        return s if "@" in s else None

    def recipient_emails(self):
        return [u.email for u in self.recipients.all()]

    def serialize(self, current_user_email=None):
        """
        JSON-serializable representation for the frontend.
        Pass current_user_email from the view to compute is_owner.
        """
        sender_val = self.sender_email() or (self.sender or "")
        recipients = self.recipient_emails()
        return {
            "id": self.id,
            "user": self.user.email if self.user else None,
            "sender": sender_val,
            "sender_email": sender_val if "@" in str(sender_val) else None,
            "recipients": recipients,
            "recipient_emails": recipients,
            "subject": self.subject,
            "body": self.body,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "read": self.read,
            "archived": self.archived,
            "deleted": self.deleted,
            "previous_mailbox": self.previous_mailbox,
            "is_owner": (current_user_email is not None and current_user_email == (self.user.email if self.user else None)),
        }
