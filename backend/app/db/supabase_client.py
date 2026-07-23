from __future__ import annotations

from functools import lru_cache

from app.config import get_settings


@lru_cache
def get_supabase_client():
    settings = get_settings()
    if not settings.supabase_configured:
        return None

    from supabase import create_client

    key = settings.supabase_service_role_key or settings.supabase_anon_key
    assert settings.supabase_url and key
    return create_client(settings.supabase_url, key)
