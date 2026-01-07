# mail/models.py
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Minimal custom user model using email as the unique identifier.
    Keeps first_name and last_name from AbstractUser.
    """
    username = None
    email = models.EmailField("email address", unique=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class Email(models.Model):
    """
    Per-user copy email model.
    Each user has their own Email row (owner = user). Sender is stored as a readable string.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_emails",
        related_query_name="owned_email",
    )
    # store sender as readable string (email or display name)
    sender = models.CharField(max_length=255)
    # recipients are User instances
    recipients = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="received_emails",
        blank=True,
    )

    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    read = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)
    deleted = models.BooleanField(default=False)

    # optional: remember where this copy originally lived (inbox/sent/archive)
    previous_mailbox = models.CharField(max_length=32, blank=True, null=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.subject or '(no subject)'} ({self.id})"

    # --- convenience helpers for serialization / frontend ---

    def sender_email(self):
        """Return sender if it looks like an email address, otherwise None."""
        s = (self.sender or "").strip()
        return s if "@" in s else None

    def recipient_emails(self):
        """Return list of recipient email strings."""
        return [u.email for u in self.recipients.all()]

    def serialize(self, current_user_email=None):
        """
        Return a JSON-serializable dict for the frontend.
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
            "is_owner": (
                current_user_email is not None
                and current_user_email == (self.user.email if self.user else None)
            ),
        }
