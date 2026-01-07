# mail/views.py
import json
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError
from django.db.models import Q
from django.http import JsonResponse, HttpResponse
from django.shortcuts import HttpResponseRedirect, render
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt

from .models import User, Email


def index(request):
    if request.user.is_authenticated:
        return render(request, "mail/inbox.html")
    else:
        return HttpResponseRedirect(reverse("login"))


@csrf_exempt
@login_required
def compose(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST request required."}, status=400)

    data = json.loads(request.body or "{}")
    emails = [email.strip() for email in data.get("recipients", "").split(",") if email.strip()]
    if not emails:
        return JsonResponse({"error": "At least one recipient required."}, status=400)

    recipients = []
    for email in emails:
        try:
            user = User.objects.get(email=email)
            recipients.append(user)
        except User.DoesNotExist:
            return JsonResponse({"error": f"User with email {email} does not exist."}, status=400)

    subject = data.get("subject", "")
    body = data.get("body", "")

    users = set()
    users.add(request.user)
    users.update(recipients)
    for user in users:
        email_obj = Email(
            user=user,
            sender=request.user.email,
            subject=subject,
            body=body,
            read=(user == request.user)
        )
        email_obj.save()
        for recipient in recipients:
            email_obj.recipients.add(recipient)
        email_obj.save()

    return JsonResponse({"message": "Email sent successfully."}, status=201)


@login_required
def mailbox(request, mailbox):
    """
    mailbox: 'inbox', 'sent', 'archive', 'trash'
    Note: sent and inbox exclude archived/deleted copies.
    Archive includes archived copies where user is sender or recipient.
    """
    if mailbox == "inbox":
        emails = Email.objects.filter(user=request.user, recipients=request.user, archived=False, deleted=False)
    elif mailbox == "sent":
        emails = Email.objects.filter(user=request.user, sender=request.user.email, archived=False, deleted=False)
    elif mailbox == "archive":
        emails = Email.objects.filter(user=request.user, archived=True, deleted=False).filter(Q(recipients=request.user) | Q(sender=request.user.email))
    elif mailbox == "trash":
        emails = Email.objects.filter(user=request.user, deleted=True)
    else:
        return JsonResponse({"error": "Invalid mailbox."}, status=400)

    emails = emails.order_by("-timestamp").all()
    return JsonResponse([email.serialize() for email in emails], safe=False)


@csrf_exempt
@login_required
def email(request, email_id):
    """
    GET: return email
    PUT: update fields (read, archived, deleted)
         - when deleted becomes True, set previous_mailbox to the logical origin
         - when deleted becomes False (restore), clear previous_mailbox
    DELETE: permanently delete only if deleted==True
    """
    try:
        email_obj = Email.objects.get(user=request.user, pk=email_id)
    except Email.DoesNotExist:
        return JsonResponse({"error": "Email not found."}, status=404)

    if request.method == "GET":
        return JsonResponse(email_obj.serialize())

    elif request.method == "PUT":
        data = json.loads(request.body or "{}")

        # read/archived updates
        if "read" in data:
            email_obj.read = bool(data["read"])

        if "archived" in data:
            email_obj.archived = bool(data["archived"])

        # deleted toggle: when moving to trash, set previous_mailbox; when restoring, clear it
        if "deleted" in data:
            new_deleted = bool(data["deleted"])
            # If moving to trash and it wasn't deleted before, set previous_mailbox
            if new_deleted and not email_obj.deleted:
                # Determine logical origin:
                # If archived flag is True -> previous_mailbox = 'archive'
                # Else if sender equals the user's email -> 'sent'
                # Else -> 'inbox'
                if email_obj.archived:
                    email_obj.previous_mailbox = "archive"
                elif email_obj.sender == request.user.email:
                    email_obj.previous_mailbox = "sent"
                else:
                    email_obj.previous_mailbox = "inbox"
                email_obj.deleted = True
            elif not new_deleted and email_obj.deleted:
                # Restoring: clear previous_mailbox (we'll let client route using previous_mailbox before clearing)
                email_obj.deleted = False
                # Keep previous_mailbox value for one more serialize if needed by client,
                # but clear it so future deletes will recompute origin.
                # To let client read it, we clear after saving below.
                prev = email_obj.previous_mailbox
                email_obj.previous_mailbox = None
                email_obj.save()
                # Return 204; client can fetch the email again if needed.
                return HttpResponse(status=204)

        email_obj.save()
        return HttpResponse(status=204)

    elif request.method == "DELETE":
        if email_obj.deleted:
            email_obj.delete()
            return HttpResponse(status=204)
        else:
            return JsonResponse({"error": "Move to Trash before permanent deletion."}, status=400)

    else:
        return JsonResponse({"error": "GET, PUT or DELETE request required."}, status=400)


def login_view(request):
    if request.method == "POST":
        email = request.POST.get("email", "").strip()
        password = request.POST.get("password", "")
        user = authenticate(request, username=email, password=password)
        if user is not None:
            login(request, user)
            return HttpResponseRedirect(reverse("index"))
        else:
            return render(request, "mail/login.html", {"message": "Invalid email and/or password."})
    else:
        return render(request, "mail/login.html")


def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse("index"))


def register(request):
    if request.method == "POST":
        email = (request.POST.get("email") or "").strip()
        password = request.POST.get("password", "")
        confirmation = request.POST.get("confirmation", "")

        if not email:
            return render(request, "mail/register.html", {"message": "Email address is required."})

        if not password:
            return render(request, "mail/register.html", {"message": "Password is required."})

        if password != confirmation:
            return render(request, "mail/register.html", {"message": "Passwords must match."})

        try:
            user = User.objects.create_user(username=email, email=email, password=password)
            user.save()
        except IntegrityError:
            return render(request, "mail/register.html", {"message": "Email address already taken."})
        except ValueError:
            return render(request, "mail/register.html", {"message": "Invalid username/email."})

        login(request, user)
        return HttpResponseRedirect(reverse("index"))
    else:
        return render(request, "mail/register.html")
