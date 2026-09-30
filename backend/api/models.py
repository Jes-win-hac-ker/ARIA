"""MySQL-backed session memory for ARIA conversations."""
from django.db import models


class ChatSession(models.Model):
    """One conversation thread; agent memory rows reference this session."""

    session_id = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    token_usage = models.IntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.session_id} ({self.created_at:%Y-%m-%d %H:%M})'
