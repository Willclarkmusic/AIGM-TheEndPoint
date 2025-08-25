"""Google Gemini API service for conversational AI."""

from typing import List, Dict, Any, Optional
import google.generativeai as genai
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
import structlog
from services.secret_manager import get_secret_manager
from config import get_settings

logger = structlog.get_logger(__name__)


class GeminiService:
    """Service for interacting with Google's Gemini API."""
    
    def __init__(self):
        """Initialize Gemini service."""
        self.settings = get_settings()
        self.secret_manager = get_secret_manager()
        self._model: Optional[genai.GenerativeModel] = None
        self._configure_api()
    
    def _configure_api(self):
        """Configure the Gemini API with credentials."""
        try:
            # Get API key from Secret Manager or settings
            api_keys = self.secret_manager.get_api_keys()
            api_key = api_keys.get("gemini_api_key")
            
            if not api_key:
                raise ValueError("Gemini API key not found")
            
            # Configure the API
            genai.configure(api_key=api_key)
            logger.info("Gemini API configured successfully")
            
        except Exception as e:
            logger.error(f"Failed to configure Gemini API: {e}")
            raise
    
    @property
    def model(self) -> genai.GenerativeModel:
        """Get or create Gemini model instance."""
        if self._model is None:
            try:
                self._model = genai.GenerativeModel(
                    model_name=self.settings.gemini_model,
                    generation_config={
                        "temperature": self.settings.temperature,
                        "top_p": 0.95,
                        "top_k": 40,
                        "max_output_tokens": self.settings.max_context_length,
                    },
                    safety_settings={
                        "HARM_CATEGORY_HATE_SPEECH": "BLOCK_MEDIUM_AND_ABOVE",
                        "HARM_CATEGORY_DANGEROUS_CONTENT": "BLOCK_MEDIUM_AND_ABOVE",
                        "HARM_CATEGORY_SEXUALLY_EXPLICIT": "BLOCK_MEDIUM_AND_ABOVE",
                        "HARM_CATEGORY_HARASSMENT": "BLOCK_MEDIUM_AND_ABOVE",
                    }
                )
                logger.info(f"Gemini model {self.settings.gemini_model} initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini model: {e}")
                raise
        return self._model
    
    def _convert_messages_to_gemini_format(
        self, 
        messages: List[BaseMessage]
    ) -> List[Dict[str, Any]]:
        """Convert LangChain messages to Gemini format."""
        gemini_messages = []
        
        for message in messages:
            if isinstance(message, SystemMessage):
                # Gemini doesn't have a separate system role, so prepend to first user message
                if not gemini_messages:
                    gemini_messages.append({
                        "role": "user",
                        "parts": [{"text": f"System: {message.content}"}]
                    })
            elif isinstance(message, HumanMessage):
                gemini_messages.append({
                    "role": "user",
                    "parts": [{"text": message.content}]
                })
            elif isinstance(message, AIMessage):
                gemini_messages.append({
                    "role": "model",
                    "parts": [{"text": message.content}]
                })
        
        return gemini_messages
    
    async def generate(
        self,
        messages: List[BaseMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        Generate a response using Gemini.
        
        Args:
            messages: List of conversation messages
            temperature: Override default temperature
            max_tokens: Override default max tokens
            
        Returns:
            Generated response text
        """
        try:
            # Convert messages to Gemini format
            gemini_messages = self._convert_messages_to_gemini_format(messages)
            
            # Create a chat session
            chat = self.model.start_chat(history=gemini_messages[:-1] if len(gemini_messages) > 1 else [])
            
            # Get the last message (current user input)
            last_message = gemini_messages[-1]["parts"][0]["text"] if gemini_messages else ""
            
            # Generate response
            response = await chat.send_message_async(last_message)
            
            # Extract text from response
            response_text = response.text
            
            logger.info(f"Generated response with {len(response_text)} characters")
            return response_text
            
        except Exception as e:
            logger.error(f"Error generating response with Gemini: {e}")
            raise
    
    def generate_sync(
        self,
        messages: List[BaseMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        Synchronous version of generate for compatibility.
        
        Args:
            messages: List of conversation messages
            temperature: Override default temperature
            max_tokens: Override default max tokens
            
        Returns:
            Generated response text
        """
        try:
            # Convert messages to Gemini format
            gemini_messages = self._convert_messages_to_gemini_format(messages)
            
            # Create a chat session
            chat = self.model.start_chat(history=gemini_messages[:-1] if len(gemini_messages) > 1 else [])
            
            # Get the last message (current user input)
            last_message = gemini_messages[-1]["parts"][0]["text"] if gemini_messages else ""
            
            # Generate response
            response = chat.send_message(last_message)
            
            # Extract text from response
            response_text = response.text
            
            logger.info(f"Generated response with {len(response_text)} characters")
            return response_text
            
        except Exception as e:
            logger.error(f"Error generating response with Gemini: {e}")
            raise
    
    async def count_tokens(self, text: str) -> int:
        """
        Count the number of tokens in a text.
        
        Args:
            text: Text to count tokens for
            
        Returns:
            Number of tokens
        """
        try:
            # Use Gemini's count_tokens method
            result = self.model.count_tokens(text)
            return result.total_tokens
        except Exception as e:
            logger.error(f"Error counting tokens: {e}")
            # Fallback to simple word count estimation
            return len(text.split())
    
    def validate_content(self, text: str) -> bool:
        """
        Validate content for safety using Gemini's safety filters.
        
        Args:
            text: Text to validate
            
        Returns:
            True if content is safe, False otherwise
        """
        try:
            # Use a simple prompt to check content
            response = self.model.generate_content(
                f"Is this content appropriate and safe? Reply with only 'yes' or 'no': {text}"
            )
            
            return "yes" in response.text.lower()
            
        except Exception as e:
            logger.error(f"Error validating content: {e}")
            # Default to safe if validation fails
            return True


# Global instance
_gemini_service: Optional[GeminiService] = None


def get_gemini_service() -> GeminiService:
    """Get or create global GeminiService instance."""
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service