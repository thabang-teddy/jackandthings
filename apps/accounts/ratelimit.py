import hashlib

from django.core.cache import cache

WINDOW, LIMIT, LOCK = 15 * 60, 5, 60


def _key(kind: str, email: str, ip: str) -> str:
    digest = hashlib.sha256(f"{email}|{ip}".encode()).hexdigest()[:32]
    return f"login:{kind}:{digest}"


def is_locked(email: str, ip: str) -> bool:
    return bool(cache.get(_key("lock", email, ip)))


def record_failure(email: str, ip: str) -> None:
    count = cache.get(_key("fail", email, ip), 0) + 1
    if count >= LIMIT:
        cache.set(_key("lock", email, ip), True, LOCK)
        cache.delete(_key("fail", email, ip))
    else:
        cache.set(_key("fail", email, ip), count, WINDOW)


def clear(email: str, ip: str) -> None:
    cache.delete_many([_key("fail", email, ip), _key("lock", email, ip)])
