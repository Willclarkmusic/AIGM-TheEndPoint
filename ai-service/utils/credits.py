"""Credit management utilities."""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any
import structlog
from services.firestore_service import get_firestore_service
from models import UserCredits
from config import get_settings

logger = structlog.get_logger(__name__)


class CreditManager:
    """Utility class for managing user credits and subscriptions."""
    
    def __init__(self):
        """Initialize credit manager."""
        self.firestore = get_firestore_service()
        self.settings = get_settings()
    
    async def reset_monthly_credits(self, user_id: str) -> bool:
        """
        Reset user's monthly credits if needed.
        
        Args:
            user_id: User ID to reset credits for
            
        Returns:
            True if credits were reset, False otherwise
        """
        try:
            user_credits = await self.firestore.get_user_credits(user_id)
            if not user_credits:
                logger.warning(f"User {user_id} not found for credit reset")
                return False
            
            # Check if it's time to reset (monthly)
            now = datetime.now(timezone.utc)
            last_reset = user_credits.last_reset
            
            # If more than 30 days since last reset
            if (now - last_reset).days >= 30:
                # Reset credits based on subscription tier
                new_chat_credits = self.settings.free_chat_credits_monthly
                new_gen_credits = self.settings.free_gen_ai_credits_monthly
                
                # TODO: Implement premium tiers
                if user_credits.subscription_tier == "premium":
                    new_chat_credits = 100
                    new_gen_credits = 50
                elif user_credits.subscription_tier == "pro":
                    new_chat_credits = 500
                    new_gen_credits = 200
                
                # Update in Firestore
                doc_ref = self.firestore.db.collection("users").document(user_id)
                doc_ref.update({
                    "chatCredits": new_chat_credits,
                    "genAICredits": new_gen_credits,
                    "lastCreditReset": now
                })
                
                logger.info(f"Reset credits for user {user_id}: chat={new_chat_credits}, gen={new_gen_credits}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error resetting credits for user {user_id}: {e}")
            return False
    
    async def add_credits(
        self,
        user_id: str,
        credit_type: str,
        amount: int,
        reason: str = "purchase"
    ) -> bool:
        """
        Add credits to user's account.
        
        Args:
            user_id: User ID
            credit_type: "chat" or "genai"
            amount: Amount to add
            reason: Reason for adding credits
            
        Returns:
            True if successful
        """
        try:
            field_name = "chatCredits" if credit_type == "chat" else "genAICredits"
            
            # Get current user
            doc_ref = self.firestore.db.collection("users").document(user_id)
            doc = doc_ref.get()
            
            if not doc.exists:
                logger.error(f"User {user_id} not found for credit addition")
                return False
            
            data = doc.to_dict()
            current_credits = data.get(field_name, 0)
            new_credits = current_credits + amount
            
            # Update credits
            doc_ref.update({
                field_name: new_credits,
                f"last{credit_type.capitalize()}CreditAdded": datetime.now(timezone.utc)
            })
            
            # Log the transaction
            await self._log_credit_transaction(
                user_id=user_id,
                credit_type=credit_type,
                amount=amount,
                transaction_type="add",
                reason=reason
            )
            
            logger.info(f"Added {amount} {credit_type} credits to user {user_id}: {current_credits} -> {new_credits}")
            return True
            
        except Exception as e:
            logger.error(f"Error adding credits to user {user_id}: {e}")
            return False
    
    async def get_credit_usage_stats(self, user_id: str) -> Dict[str, Any]:
        """
        Get user's credit usage statistics.
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with usage stats
        """
        try:
            # Query recent interactions
            now = datetime.now(timezone.utc)
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            interactions = (
                self.firestore.db.collection("ai_interactions")
                .where("userId", "==", user_id)
                .where("timestamp", ">=", month_start)
                .stream()
            )
            
            # Calculate stats
            chat_usage = 0
            gen_usage = 0
            total_tokens = 0
            
            for interaction in interactions:
                data = interaction.to_dict()
                interaction_type = data.get("type", "")
                credits_used = data.get("creditsUsed", 0)
                tokens_used = data.get("tokensUsed", 0)
                
                if interaction_type == "chat":
                    chat_usage += credits_used
                elif interaction_type == "generation":
                    gen_usage += credits_used
                
                total_tokens += tokens_used
            
            return {
                "user_id": user_id,
                "period": "current_month",
                "chat_credits_used": chat_usage,
                "gen_ai_credits_used": gen_usage,
                "total_tokens_used": total_tokens,
                "period_start": month_start,
                "period_end": now
            }
            
        except Exception as e:
            logger.error(f"Error getting usage stats for user {user_id}: {e}")
            return {}
    
    async def _log_credit_transaction(
        self,
        user_id: str,
        credit_type: str,
        amount: int,
        transaction_type: str,
        reason: str
    ):
        """Log a credit transaction for audit purposes."""
        try:
            transaction_data = {
                "userId": user_id,
                "creditType": credit_type,
                "amount": amount,
                "type": transaction_type,  # "add", "deduct", "reset"
                "reason": reason,
                "timestamp": datetime.now(timezone.utc)
            }
            
            self.firestore.db.collection("credit_transactions").add(transaction_data)
            
        except Exception as e:
            logger.error(f"Error logging credit transaction: {e}")


# Global instance
_credit_manager = None


def get_credit_manager() -> CreditManager:
    """Get or create global CreditManager instance."""
    global _credit_manager
    if _credit_manager is None:
        _credit_manager = CreditManager()
    return _credit_manager