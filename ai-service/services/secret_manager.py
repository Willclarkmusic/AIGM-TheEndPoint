"""Google Cloud Secret Manager service for secure API key retrieval."""

import os
from typing import Optional, Dict, Any
from functools import lru_cache
import structlog
from google.cloud import secretmanager
from google.api_core import exceptions
from config import get_settings

logger = structlog.get_logger(__name__)


class SecretManagerService:
    """Service for managing secrets using Google Cloud Secret Manager."""
    
    def __init__(self):
        """Initialize Secret Manager client."""
        self.settings = get_settings()
        self._client: Optional[secretmanager.SecretManagerServiceClient] = None
        self._secrets_cache: Dict[str, str] = {}
        
    @property
    def client(self) -> secretmanager.SecretManagerServiceClient:
        """Get or create Secret Manager client."""
        if self._client is None:
            try:
                self._client = secretmanager.SecretManagerServiceClient()
                logger.info("Secret Manager client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Secret Manager client: {e}")
                raise
        return self._client
    
    def _get_secret_path(self, secret_id: str) -> str:
        """Build the resource name for a secret."""
        project_id = self.settings.gcp_project_id or os.getenv("GCP_PROJECT")
        return f"projects/{project_id}/secrets/{secret_id}/versions/latest"
    
    @lru_cache(maxsize=10)
    def get_secret(self, secret_id: str) -> Optional[str]:
        """
        Retrieve a secret from Google Cloud Secret Manager.
        
        Args:
            secret_id: The ID of the secret to retrieve
            
        Returns:
            The secret value as a string, or None if not found
        """
        # Check cache first
        if secret_id in self._secrets_cache:
            return self._secrets_cache[secret_id]
        
        # In development, try environment variables first
        if self.settings.environment == "development":
            env_value = os.getenv(secret_id.upper())
            if env_value:
                logger.info(f"Retrieved secret {secret_id} from environment")
                self._secrets_cache[secret_id] = env_value
                return env_value
        
        # Try Secret Manager
        try:
            secret_path = self._get_secret_path(secret_id)
            response = self.client.access_secret_version(request={"name": secret_path})
            secret_value = response.payload.data.decode("UTF-8")
            
            # Cache the secret
            self._secrets_cache[secret_id] = secret_value
            logger.info(f"Retrieved secret {secret_id} from Secret Manager")
            return secret_value
            
        except exceptions.NotFound:
            logger.warning(f"Secret {secret_id} not found in Secret Manager")
            return None
        except Exception as e:
            logger.error(f"Error retrieving secret {secret_id}: {e}")
            return None
    
    def get_api_keys(self) -> Dict[str, Optional[str]]:
        """
        Retrieve all API keys needed for the service.
        
        Returns:
            Dictionary of API key names to values
        """
        api_keys = {
            "gemini_api_key": self.get_secret("gemini_api_key") or self.settings.gemini_api_key,
            "stability_api_key": self.get_secret("stability_api_key") or self.settings.stability_api_key,
        }
        
        # Validate that we have required keys
        missing_keys = [k for k, v in api_keys.items() if not v]
        if missing_keys:
            logger.warning(f"Missing API keys: {missing_keys}")
        
        return api_keys
    
    def clear_cache(self):
        """Clear the secrets cache."""
        self._secrets_cache.clear()
        self.get_secret.cache_clear()
        logger.info("Secrets cache cleared")


# Global instance
_secret_manager: Optional[SecretManagerService] = None


def get_secret_manager() -> SecretManagerService:
    """Get or create global SecretManagerService instance."""
    global _secret_manager
    if _secret_manager is None:
        _secret_manager = SecretManagerService()
    return _secret_manager