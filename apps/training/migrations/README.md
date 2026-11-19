# Training migrations

1. `python manage.py makemigrations training` → creates `0001_initial.py`.
2. `python manage.py makemigrations training --empty --name seed_exercises` → creates `0002_seed_exercises.py`.
3. Replace the body of 0002 with:

```python
from django.db import migrations

from apps.training.seed import seed, unseed


class Migration(migrations.Migration):
    dependencies = [("training", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
```

4. `python manage.py migrate`.
