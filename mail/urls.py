# mail/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="mail_index"),
    path("emails/<str:mailbox_name>", views.mailbox, name="mailbox"),
    path("emails/<int:email_id>", views.email_detail, name="email_detail"),
    path("emails/<int:email_id>/action", views.email_action, name="email_action"),
]
