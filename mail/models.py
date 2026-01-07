# mail/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings

class User(AbstractUser):
    """
    Minimal custom user model.
    Uses email as the unique identifier for login (USERNAME_FIELD).
    Keeps first_name/last_name fields from AbstractUser.
    """
    username = None  # we will use email as the unique identifier
    email = models.EmailField('email address', unique=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []  # no additional required fields

    def __str__(self):
        return self.email

# Email model (per-user copy model)
class Email(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)  # owner of this copy
    sender = models.CharField(max_length=255)  # store sender as readable string (email or name)
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
