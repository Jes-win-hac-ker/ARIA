"""MySQL-backed session memory for ARIA conversations."""
from django.db import models


# ============================================================
# Session / Message / Tool Call — for agent conversation memory
# ============================================================

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


class Message(models.Model):
    ROLE_CHOICES = [('user', 'User'), ('assistant', 'Assistant')]

    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE, related_name='messages'
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    correlation_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.role}: {self.content[:60]}'


class ToolCall(models.Model):
    message = models.ForeignKey(
        Message, on_delete=models.CASCADE, related_name='tool_calls'
    )
    tool_name = models.CharField(max_length=100)
    input_args = models.JSONField()
    output_result = models.JSONField()
    latency_ms = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.tool_name} ({self.latency_ms}ms)'


# ============================================================
# Bhavcopy — daily price data from NSE
# ============================================================

class Bhavcopy(models.Model):
    trad_dt = models.DateField()
    tckr_symb = models.CharField(max_length=50)
    isin = models.CharField(max_length=20)
    fin_instrm_nm = models.CharField(max_length=255, blank=True)
    cls_pric = models.DecimalField(max_digits=15, decimal_places=2)
    prvs_clsg_pric = models.DecimalField(max_digits=15, decimal_places=2)
    ttl_tradg_vol = models.BigIntegerField()
    ttl_trf_val = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True
    )
    scty_srs = models.CharField(max_length=10)

    class Meta:
        unique_together = ('trad_dt', 'tckr_symb', 'scty_srs')
        indexes = [
            models.Index(fields=['tckr_symb', 'trad_dt']),
            models.Index(fields=['trad_dt']),
        ]

    def __str__(self):
        return f'{self.tckr_symb} @ {self.trad_dt} = {self.cls_pric}'


# ============================================================
# Company Fundamental — financial metrics from corporate filings
# ============================================================

class CompanyFundamental(models.Model):
    """
    Fundamental financial metrics from annual reports, filings, and exchanges.
    Stored locally in MySQL to avoid aggressive live scraping (AGENTS.md section 5 & 7).
    """

    tckr_symb = models.CharField(max_length=50, db_index=True)
    company_name = models.CharField(max_length=255)
    sector = models.CharField(max_length=100, blank=True)
    industry = models.CharField(max_length=100, blank=True)
    market_cap_cr = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True
    )
    pe_ratio = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    pb_ratio = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    debt_to_equity = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    roe_pct = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    eps = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    dividend_yield_pct = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    revenue_cr = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True
    )
    net_profit_cr = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True
    )
    operating_margin_pct = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    fiscal_year = models.CharField(max_length=20, default='FY2025-26')
    as_of_date = models.DateField()
    source = models.CharField(
        max_length=255, default='Annual Report / BSE / NSE Corporate Filing'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('tckr_symb', 'fiscal_year')
        indexes = [
            models.Index(fields=['tckr_symb']),
            models.Index(fields=['as_of_date']),
        ]

    def __str__(self):
        return f'{self.tckr_symb} ({self.fiscal_year}): P/E={self.pe_ratio}, MCap={self.market_cap_cr} Cr'