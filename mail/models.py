# mail/models.py
from django.db import models
from django.conf import settings

class Email(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)  # owner of this copy
    sender = models.CharField(max_length=255)  # store sender email or display name
    recipients = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='received_emails', blank=True)
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)
    deleted = models.BooleanField(default=False)
    previous_mailbox = models.CharField(max_length=32, blank=True, null=True)

    def __str__(self):
        return f"{self.subject} ({self.id})"

    def sender_email(self):
        # If sender already stored as an email, return it; otherwise None
        s = (self.sender or "").strip()
        return s if "@" in s else None

    def recipient_emails(self):
        # Return list of recipient emails
        return [u.email for u in self.recipients.all()]

    def serialize(self, current_user_email=None):
        """
        Return JSON-serializable representation for the frontend.
        Pass current_user_email from the view to compute is_owner.
        """
        return {
            "id": self.id,
            "user": self.user.email if self.user else None,
            "sender": self.sender,
            "sender_email": self.sender_email(),
            "recipients": self.recipient_emails(),
            "recipient_emails": self.recipient_emails(),
            "subject": self.subject,
            "body": self.body,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "read": self.read,
            "archived": self.archived,
            "deleted": self.deleted,
            "previous_mailbox": self.previous_mailbox,
            "is_owner": (current_user_email is not None and current_user_email == (self.user.email if self.user else None)),
        }
