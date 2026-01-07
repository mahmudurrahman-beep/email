# mail/views.py
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseNotAllowed
from django.shortcuts import get_object_or_404, render
from .models import Email
from django.views.decorators.http import require_http_methods
import json

@login_required
def index(request):
    # Render the main app page (the JS will fetch mailbox data)
    return render(request, "mail/layout.html")

@login_required
def mailbox(request, mailbox_name):
    """
    mailbox_name: 'inbox', 'sent', 'archive', 'trash'
    Returns JSON list of serialized emails for the current user.
    """
    user = request.user
    mailbox_name = mailbox_name.lower()

    if mailbox_name == "inbox":
        # Emails where current user is the owner and not archived/deleted and not sent by them
        emails = Email.objects.filter(user=user, archived=False, deleted=False).order_by("-timestamp")
    elif mailbox_name == "sent":
        # Sent: owner copies where sender is the current user's email
        emails = Email.objects.filter(user=user, sender__icontains=user.email, deleted=False).order_by("-timestamp")
    elif mailbox_name in ("archive", "archived"):
        emails = Email.objects.filter(user=user, archived=True, deleted=False).order_by("-timestamp")
    elif mailbox_name == "trash":
        emails = Email.objects.filter(user=user, deleted=True).order_by("-timestamp")
    else:
        return HttpResponseBadRequest("Unknown mailbox")

    data = [e.serialize(current_user_email=user.email) for e in emails]
    return JsonResponse(data, safe=False)

@login_required
def email_detail(request, email_id):
    """
    Return a single email JSON for viewing.
    """
    user = request.user
    email = get_object_or_404(Email, pk=email_id, user=user)
    return JsonResponse(email.serialize(current_user_email=user.email), safe=False)

# Example endpoints for simple actions (archive, delete, mark read)
@login_required
@require_http_methods(["PUT"])
def email_action(request, email_id):
    user = request.user
    email = get_object_or_404(Email, pk=email_id, user=user)
    try:
        payload = json.loads(request.body.decode())
    except Exception:
        payload = {}

    if payload.get("action") == "archive":
        email.archived = True
        email.save()
        return JsonResponse({"status": "ok"})
    if payload.get("action") == "unarchive":
        email.archived = False
        email.save()
        return JsonResponse({"status": "ok"})
    if payload.get("action") == "delete":
        email.deleted = True
        email.save()
        return JsonResponse({"status": "ok"})
    if payload.get("action") == "mark_read":
        email.read = True
        email.save()
        return JsonResponse({"status": "ok"})
    return HttpResponseBadRequest("Unknown action")
