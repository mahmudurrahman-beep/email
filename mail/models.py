# mail/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

class User(AbstractUser):
    # keep default fields (username, email, password, etc.)
    pass

class Email(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="emails")
    sender = models.CharField(max_length=255)
    recipients = models.ManyToManyField(User, related_name="received_emails", blank=True)
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)
    timestamp = models.DateTimeField(default=timezone.now)
    read = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)
    deleted = models.BooleanField(default=False)
    # New field: store where this copy came from before moving to Trash
    previous_mailbox = models.CharField(max_length=16, blank=True, null=True)  # values: 'inbox','sent','archive' or None

    def serialize(self):
        """
        Return a JSON-serializable representation of the email.
        Include user email and previous_mailbox for client routing.
        """
        return {
            "id": self.id,
            "user": self.user.email if self.user else None,
            "sender": self.sender,
            "recipients": [u.email for u in self.recipients.all()],
            "subject": self.subject,
            "body": self.body,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "read": self.read,
            "archived": self.archived,
            "deleted": self.deleted,
            "previous_mailbox": self.previous_mailbox
        }
