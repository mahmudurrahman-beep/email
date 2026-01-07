# mail/views.py
import json
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError
from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest
from django.shortcuts import HttpResponseRedirect, render, get_object_or_404
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

    # Create per-user copies: owner is each user in the set (sender + recipients)
    users = set()
    users.add(request.user)
    users.update(recipients)
    for user in users:
        # store sender as readable string (email)
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
    mailbox = mailbox.lower()
    if mailbox == "inbox":
        emails = Email.objects.filter(user=request.user, recipients=request.user, archived=False, deleted=False)
    elif mailbox == "sent":
        # Sent: owner copies where sender equals current user's email
        emails = Email.objects.filter(user=request.user, sender__icontains=request.user.email, deleted=False)
    elif mailbox == "archive" or mailbox == "archived":
        emails = Email.objects.filter(user=request.user, archived=True, deleted=False)
    elif mailbox == "trash":
        emails = Email.objects.filter(user=request.user, deleted=True)
    else:
        return JsonResponse({"error": "Invalid mailbox."}, status=400)

    emails = emails.order_by("-timestamp").all()
    return JsonResponse([email.serialize(current_user_email=request.user.email) for email in emails], safe=False)

@csrf_exempt
@login_required
def email(request, email_id):
    try:
        email_obj = Email.objects.get(user=request.user, pk=email_id)
    except Email.DoesNotExist:
        return JsonResponse({"error": "Email not found."}, status=404)

    if request.method == "GET":
        return JsonResponse(email_obj.serialize(current_user_email=request.user.email))

    elif request.method == "PUT":
        data = json.loads(request.body or "{}")
        if "read" in data:
            email_obj.read = bool(data["read"])
        if "archived" in data:
            email_obj.archived = bool(data["archived"])
        if "deleted" in data:
            email_obj.deleted = bool(data["deleted"])
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
        email = request.POST.get("email", "")
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
        email = request.POST.get("email", "")
        password = request.POST.get("password", "")
        confirmation = request.POST.get("confirmation", "")
        if password != confirmation:
            return render(request, "mail/register.html", {"message": "Passwords must match."})
        try:
            user = User.objects.create_user(email, email, password)
            user.save()
        except IntegrityError:
            return render(request, "mail/register.html", {"message": "Email address already taken."})
        login(request, user)
        return HttpResponseRedirect(reverse("index"))
    else:
        return render(request, "mail/register.html")
