"""Firestore service for database operations."""

import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from google.cloud import firestore
from google.cloud.firestore_v1 import FieldFilter, Query
import structlog
from models import UserCredits, AgentPersonality
from config import get_settings

logger = structlog.get_logger(__name__)


class FirestoreService:
    """Service for Firestore database operations."""
    
    def __init__(self):
        """Initialize Firestore client."""
        self.settings = get_settings()
        self._db: Optional[firestore.Client] = None
        
    @property
    def db(self) -> firestore.Client:
        """Get or create Firestore client."""
        if self._db is None:
            try:
                # Use credentials file if specified
                if self.settings.firebase_credentials_path:
                    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = self.settings.firebase_credentials_path
                
                self._db = firestore.Client(project=self.settings.gcp_project_id)
                logger.info("Firestore client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Firestore client: {e}")
                raise
        return self._db
    
    async def get_user_credits(self, user_id: str) -> Optional[UserCredits]:
        """
        Get user's credit balance.
        
        Args:
            user_id: The user's ID
            
        Returns:
            UserCredits object or None if user not found
        """
        try:
            doc_ref = self.db.collection("users").document(user_id)
            doc = doc_ref.get()
            
            if not doc.exists:
                logger.warning(f"User {user_id} not found")
                return None
            
            data = doc.to_dict()
            return UserCredits(
                user_id=user_id,
                chat_credits=data.get("chatCredits", self.settings.free_chat_credits_monthly),
                gen_ai_credits=data.get("genAICredits", self.settings.free_gen_ai_credits_monthly),
                last_reset=data.get("lastCreditReset", datetime.now(timezone.utc)),
                subscription_tier=data.get("subscriptionTier", "free")
            )
            
        except Exception as e:
            logger.error(f"Error getting user credits: {e}")
            return None
    
    async def initialize_user_credits(
        self, 
        user_id: str, 
        chat_credits: int = 25, 
        gen_ai_credits: int = 25
    ) -> bool:
        """
        Initialize user document with default credits.
        
        Args:
            user_id: The user's ID
            chat_credits: Initial chat credits (default 25)
            gen_ai_credits: Initial genAI credits (default 25)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            doc_ref = self.db.collection("users").document(user_id)
            
            # Check if user already exists
            if doc_ref.get().exists:
                logger.info(f"User {user_id} already exists, skipping initialization")
                return True
            
            # Create user document with initial credits
            user_data = {
                "userId": user_id,
                "chatCredits": chat_credits,
                "genAICredits": gen_ai_credits,
                "subscriptionTier": "free",
                "lastCreditReset": firestore.SERVER_TIMESTAMP,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "lastChatCreditUsed": None,
                "lastGenaiCreditUsed": None,
                "totalChatCreditsUsed": 0,
                "totalGenAICreditsUsed": 0
            }
            
            doc_ref.set(user_data)
            logger.info(f"Initialized user {user_id} with {chat_credits} chat credits and {gen_ai_credits} genAI credits")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing user credits: {e}")
            return False
    
    async def deduct_credits(
        self, 
        user_id: str, 
        credit_type: str, 
        amount: int
    ) -> tuple[bool, int]:
        """
        Deduct credits from user's balance.
        
        Args:
            user_id: The user's ID
            credit_type: Type of credits ("chat" or "genai")
            amount: Amount to deduct
            
        Returns:
            Tuple of (success, remaining_credits)
        """
        try:
            doc_ref = self.db.collection("users").document(user_id)
            
            # Use transaction for atomic update
            transaction = self.db.transaction()
            
            @firestore.transactional
            def update_credits(transaction):
                doc = doc_ref.get(transaction=transaction)
                
                if not doc.exists:
                    logger.error(f"User {user_id} not found for credit deduction")
                    return False, 0
                
                data = doc.to_dict()
                field_name = "chatCredits" if credit_type == "chat" else "genAICredits"
                current_credits = data.get(field_name, 0)
                
                if current_credits < amount:
                    logger.warning(f"Insufficient {credit_type} credits for user {user_id}")
                    return False, current_credits
                
                new_credits = current_credits - amount
                transaction.update(doc_ref, {
                    field_name: new_credits,
                    f"last{credit_type.capitalize()}CreditUsed": firestore.SERVER_TIMESTAMP
                })
                
                return True, new_credits
            
            return update_credits(transaction)
            
        except Exception as e:
            logger.error(f"Error deducting credits: {e}")
            return False, 0
    
    async def get_agent_personality(self, agent_id: str) -> Optional[AgentPersonality]:
        """
        Get AI agent personality configuration.
        
        Args:
            agent_id: The agent's ID
            
        Returns:
            AgentPersonality object or None if not found
        """
        try:
            doc_ref = self.db.collection("ai_agents").document(agent_id)
            doc = doc_ref.get()
            
            if not doc.exists:
                logger.warning(f"Agent {agent_id} not found")
                return None
            
            data = doc.to_dict()
            return AgentPersonality(
                agent_id=agent_id,
                name=data.get("name", "Unknown Agent"),
                personality_rules=data.get("personalityRules", []),
                gen_rules=data.get("genRules", []),
                is_public=data.get("isPublic", False),
                owner_id=data.get("ownerId", ""),
                created_at=data.get("createdAt", datetime.now(timezone.utc)),
                updated_at=data.get("updatedAt", datetime.now(timezone.utc))
            )
            
        except Exception as e:
            logger.error(f"Error getting agent personality: {e}")
            return None
    
    async def check_user_agent_access(self, user_id: str, agent_id: str) -> bool:
        """
        Check if user has access to an AI agent.
        
        Args:
            user_id: The user's ID
            agent_id: The agent's ID
            
        Returns:
            True if user has access, False otherwise
        """
        try:
            # Get agent details
            agent = await self.get_agent_personality(agent_id)
            if not agent:
                return False
            
            # Public agents are accessible to all
            if agent.is_public:
                return True
            
            # Check if user owns the agent
            if agent.owner_id == user_id:
                return True
            
            # Check if agent is in user's team
            user_doc = self.db.collection("users").document(user_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                agent_team = user_data.get("aiAgentTeam", [])
                return agent_id in agent_team
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking agent access: {e}")
            return False
    
    async def log_ai_interaction(
        self,
        user_id: str,
        agent_id: str,
        interaction_type: str,
        tokens_used: int = 0,
        credits_used: int = 0,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Log an AI interaction for analytics and rate limiting.
        
        Args:
            user_id: The user's ID
            agent_id: The agent's ID
            interaction_type: Type of interaction ("chat" or "generation")
            tokens_used: Number of tokens consumed
            credits_used: Number of credits consumed
            metadata: Additional metadata
        """
        try:
            doc_data = {
                "userId": user_id,
                "agentId": agent_id,
                "type": interaction_type,
                "tokensUsed": tokens_used,
                "creditsUsed": credits_used,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "metadata": metadata or {}
            }
            
            self.db.collection("ai_interactions").add(doc_data)
            logger.info(f"Logged AI interaction for user {user_id}")
            
        except Exception as e:
            logger.error(f"Error logging AI interaction: {e}")
    
    async def get_user_rate_limit_info(
        self, 
        user_id: str, 
        window_minutes: int = 1
    ) -> Dict[str, Any]:
        """
        Get user's rate limit information.
        
        Args:
            user_id: The user's ID
            window_minutes: Time window in minutes
            
        Returns:
            Dictionary with rate limit info
        """
        try:
            # Calculate time window
            now = datetime.now(timezone.utc)
            window_start = datetime.fromtimestamp(
                now.timestamp() - (window_minutes * 60),
                timezone.utc
            )
            
            # Query recent interactions
            query = (
                self.db.collection("ai_interactions")
                .where(filter=FieldFilter("userId", "==", user_id))
                .where(filter=FieldFilter("type", "==", "chat"))
                .where(filter=FieldFilter("timestamp", ">=", window_start))
                .order_by("timestamp", direction=Query.DESCENDING)
            )
            
            interactions = list(query.stream())
            
            return {
                "count": len(interactions),
                "window_minutes": window_minutes,
                "limit": self.settings.rate_limit_per_minute,
                "remaining": max(0, self.settings.rate_limit_per_minute - len(interactions))
            }
            
        except Exception as e:
            logger.error(f"Error getting rate limit info: {e}")
            return {
                "count": 0,
                "window_minutes": window_minutes,
                "limit": self.settings.rate_limit_per_minute,
                "remaining": self.settings.rate_limit_per_minute
            }


# Global instance
_firestore_service: Optional[FirestoreService] = None


def get_firestore_service() -> FirestoreService:
    """Get or create global FirestoreService instance."""
    global _firestore_service
    if _firestore_service is None:
        _firestore_service = FirestoreService()
    return _firestore_service