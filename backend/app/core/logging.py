"""
Structured JSON logging.
Rule: NEVER log PII (email body, account numbers, names).
Sensitive fields are scrubbed via the ScrubFilter before any handler sees them.
"""

import logging
import re
import sys

import structlog

_PII_PATTERNS = [
    re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b"),  # IBANs
    re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),  # card numbers
    re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),  # emails
]


def _scrub_pii(logger, method_name: str, event_dict: dict) -> dict:
    for key, value in list(event_dict.items()):
        if isinstance(value, str):
            for pattern in _PII_PATTERNS:
                value = pattern.sub("[REDACTED]", value)
            event_dict[key] = value
    return event_dict


def configure_logging(log_level: str = "INFO") -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            _scrub_pii,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, log_level.upper(), logging.INFO)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
    )


def get_logger(name: str) -> structlog.BoundLogger:
    return structlog.get_logger(name)
