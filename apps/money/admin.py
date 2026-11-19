from django.contrib import admin

from .models import Cap, Category, Goal, GoalContribution, MoneyAccount, Receipt, Recurring, Transaction

for model in (MoneyAccount, Category, Transaction, Cap, Goal, GoalContribution, Recurring, Receipt):
    admin.site.register(model)
