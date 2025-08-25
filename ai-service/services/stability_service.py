"""Stability AI service for image and music generation."""

import io
import base64
import uuid
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
import aiohttp
import structlog
from google.cloud import storage
from services.secret_manager import get_secret_manager
from config import get_settings
from models import MediaType

logger = structlog.get_logger(__name__)


class StabilityService:
    """Service for interacting with Stability AI APIs."""
    
    def __init__(self):
        """Initialize Stability service."""
        self.settings = get_settings()
        self.secret_manager = get_secret_manager()
        self._api_key: Optional[str] = None
        self._storage_client: Optional[storage.Client] = None
        self.base_url = "https://api.stability.ai"
        
    @property
    def api_key(self) -> str:
        """Get Stability API key."""
        if self._api_key is None:
            api_keys = self.secret_manager.get_api_keys()
            self._api_key = api_keys.get("stability_api_key")
            
            if not self._api_key:
                raise ValueError("Stability API key not found")
                
        return self._api_key
    
    @property
    def storage_client(self) -> storage.Client:
        """Get or create Cloud Storage client."""
        if self._storage_client is None:
            try:
                self._storage_client = storage.Client(project=self.settings.gcp_project_id)
                logger.info("Cloud Storage client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Cloud Storage client: {e}")
                raise
        return self._storage_client
    
    def _get_headers(self) -> Dict[str, str]:
        """Get common headers for Stability API requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }
    
    async def generate_image(
        self,
        prompt: str,
        style: Optional[str] = None,
        width: int = 1024,
        height: int = 1024,
        cfg_scale: float = 7.0,
        samples: int = 1
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generate an image using Stability AI.
        
        Args:
            prompt: Text prompt for image generation
            style: Optional style preset
            width: Image width (must be multiple of 64)
            height: Image height (must be multiple of 64)
            cfg_scale: How strictly to follow the prompt (0-35)
            samples: Number of images to generate
            
        Returns:
            Tuple of (image_url, metadata)
        """
        try:
            # Prepare request data
            data = {
                "text_prompts": [{"text": prompt, "weight": 1}],
                "cfg_scale": cfg_scale,
                "height": height,
                "width": width,
                "samples": samples,
                "steps": 30,
            }
            
            if style:
                data["style_preset"] = style
            
            # Make API request
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/v1/generation/{self.settings.stability_engine}/text-to-image",
                    headers=self._get_headers(),
                    json=data
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"Stability API error: {error_text}")
                        raise Exception(f"API error: {response.status}")
                    
                    result = await response.json()
            
            # Process the first image
            if not result.get("artifacts"):
                raise Exception("No images generated")
            
            artifact = result["artifacts"][0]
            image_data = base64.b64decode(artifact["base64"])
            
            # Generate unique filename
            request_id = str(uuid.uuid4())
            filename = f"generated/images/{request_id}.png"
            
            # Upload to Cloud Storage
            bucket = self.storage_client.bucket(self.settings.gcs_bucket_name)
            blob = bucket.blob(filename)
            blob.upload_from_string(image_data, content_type="image/png")
            
            # Make blob public
            blob.make_public()
            
            # Get public URL
            image_url = blob.public_url
            
            # Build metadata
            metadata = {
                "request_id": request_id,
                "prompt": prompt,
                "style": style,
                "dimensions": f"{width}x{height}",
                "engine": self.settings.stability_engine,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Generated image: {request_id}")
            return image_url, metadata
            
        except Exception as e:
            logger.error(f"Error generating image: {e}")
            raise
    
    async def generate_music(
        self,
        prompt: str,
        duration: int = 30,
        style: Optional[str] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generate music using Stability AI.
        
        Args:
            prompt: Text prompt for music generation
            duration: Duration in seconds (max 180)
            style: Optional music style
            
        Returns:
            Tuple of (music_url, metadata)
        """
        try:
            # Validate duration
            duration = min(duration, 180)  # Max 3 minutes
            
            # Prepare request data
            data = {
                "text_prompts": [{"text": prompt}],
                "duration": duration,
            }
            
            if style:
                data["style"] = style
            
            # Make API request
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/v1/generation/{self.settings.stability_music_engine}/text-to-audio",
                    headers=self._get_headers(),
                    json=data
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"Stability API error: {error_text}")
                        raise Exception(f"API error: {response.status}")
                    
                    # Audio generation returns binary data
                    audio_data = await response.read()
            
            # Generate unique filename
            request_id = str(uuid.uuid4())
            filename = f"generated/music/{request_id}.mp3"
            
            # Upload to Cloud Storage
            bucket = self.storage_client.bucket(self.settings.gcs_bucket_name)
            blob = bucket.blob(filename)
            blob.upload_from_string(audio_data, content_type="audio/mpeg")
            
            # Make blob public
            blob.make_public()
            
            # Get public URL
            music_url = blob.public_url
            
            # Build metadata
            metadata = {
                "request_id": request_id,
                "prompt": prompt,
                "duration": duration,
                "style": style,
                "engine": self.settings.stability_music_engine,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Generated music: {request_id}")
            return music_url, metadata
            
        except Exception as e:
            logger.error(f"Error generating music: {e}")
            raise
    
    async def generate_album_art(
        self,
        prompt: str,
        music_metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generate album art for music tracks.
        
        Args:
            prompt: Text prompt for album art
            music_metadata: Optional metadata from music generation
            
        Returns:
            Tuple of (art_url, metadata)
        """
        # Album art uses the same image generation with specific parameters
        album_prompt = f"Album cover art: {prompt}"
        if music_metadata and music_metadata.get("style"):
            album_prompt += f", {music_metadata['style']} style"
        
        return await self.generate_image(
            prompt=album_prompt,
            width=512,  # Standard album art size
            height=512,
            style="photographic"
        )
    
    def get_generation_cost(self, media_type: MediaType, duration: Optional[int] = None) -> int:
        """
        Calculate the credit cost for a generation request.
        
        Args:
            media_type: Type of media to generate
            duration: Duration for music generation
            
        Returns:
            Credit cost
        """
        if media_type == MediaType.IMAGE:
            return self.settings.image_generation_cost
        elif media_type == MediaType.MUSIC:
            return self.settings.music_generation_cost
        elif media_type == MediaType.ALBUM_ART:
            return self.settings.image_generation_cost
        else:
            raise ValueError(f"Unknown media type: {media_type}")


# Global instance
_stability_service: Optional[StabilityService] = None


def get_stability_service() -> StabilityService:
    """Get or create global StabilityService instance."""
    global _stability_service
    if _stability_service is None:
        _stability_service = StabilityService()
    return _stability_service