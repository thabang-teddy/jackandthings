"""Private uploads: verified, EXIF-stripped, stored per user outside the web root."""
from __future__ import annotations

import io
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile

ALLOWED = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}


def clean_private_image(upload) -> tuple[ContentFile, str]:
    """Verify an upload is really an image, strip EXIF (GPS!), return (file, content_type)."""
    from PIL import Image, ImageOps, UnidentifiedImageError  # Pillow; imported here so core loads without it

    if upload.size > settings.MAX_UPLOAD_BYTES:
        raise ValidationError("Images must be 5 MB or smaller.")
    try:
        Image.open(upload).verify()          # cheap structural check
        upload.seek(0)
        img: Image.Image = Image.open(upload)
        fmt = img.format
        img = ImageOps.exif_transpose(img)   # apply rotation, then we save WITHOUT the EXIF block
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise ValidationError("That file isn't a JPEG, PNG or WebP image.") from exc
    if fmt not in ALLOWED:
        raise ValidationError("Use a JPEG, PNG or WebP image.")
    if fmt == "JPEG" and img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    out = io.BytesIO()
    img.save(out, format=fmt, **({"quality": 88} if fmt in {"JPEG", "WEBP"} else {}))
    ext = ALLOWED[fmt]
    return ContentFile(out.getvalue(), name=f"{uuid.uuid4().hex}.{ext}"), f"image/{ext.replace('jpg', 'jpeg')}"


def user_upload_path(instance, filename: str) -> str:
    return f"u{instance.owner_id}/{instance._meta.model_name}/{filename}"   # under PRIVATE_MEDIA_ROOT


def delete_file(field_file) -> None:
    """Remove the file from disk (Django never deletes files on its own)."""
    if field_file:
        field_file.storage.delete(field_file.name)
