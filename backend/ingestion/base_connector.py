"""
Abstract base for all data source connectors.
Every connector must implement fetch() and return a list of TransactionCreate.
The pipeline calls fetch() without knowing which connector it's talking to.
"""

from abc import ABC, abstractmethod
from app.models.transaction import TransactionCreate


class BaseConnector(ABC):
    @property
    @abstractmethod
    def source_name(self) -> str:
        ...

    @abstractmethod
    def fetch(self) -> list[TransactionCreate]:
        """Pull raw data from the source and return normalized transactions."""
        ...
