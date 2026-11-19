from django.db import migrations

from apps.training.seed import seed, unseed


class Migration(migrations.Migration):
    dependencies = [("training", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
