# mail/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("login", views.login_view, name="login"),
    path("logout", views.logout_view, name="logout"),
    path("register", views.register, name="register"),

    # API Routes
    path("emails", views.compose, name="compose"),                    # POST to send
    path("emails/<int:email_id>", views.email, name="email"),         # GET/PUT/DELETE single email
    path("emails/<str:mailbox>", views.mailbox, name="mailbox"),      # GET mailbox list
]
