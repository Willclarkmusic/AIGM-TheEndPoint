"""LangGraph agent service for building AI agents with personalities."""

from typing import List, Dict, Any, Optional, Tuple
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain.memory import ConversationBufferMemory
from langgraph.graph import StateGraph, END
import structlog
from models import AgentPersonality
from config import get_settings

logger = structlog.get_logger(__name__)


class LangGraphAgent:
    """Generic AI agent builder using LangGraph."""
    
    def __init__(self, personality: AgentPersonality, llm_client: Any):
        """
        Initialize the agent with personality and LLM client.
        
        Args:
            personality: Agent personality configuration
            llm_client: Language model client (e.g., Gemini)
        """
        self.personality = personality
        self.llm_client = llm_client
        self.settings = get_settings()
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )
        self.graph = self._build_graph()
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt from personality rules."""
        base_prompt = f"You are {self.personality.name}, an AI assistant."
        
        if self.personality.personality_rules:
            rules_text = "\n".join([
                f"- {rule}" for rule in self.personality.personality_rules
            ])
            return f"{base_prompt}\n\nYour personality and behavior rules:\n{rules_text}"
        
        return base_prompt
    
    def _build_graph(self):
        """Build the LangGraph workflow."""
        # Define the state schema
        from typing import TypedDict
        
        class AgentState(TypedDict):
            message: str
            context: List[Dict[str, str]]
            response: str
            messages: List[BaseMessage]
            error: Optional[str]
            validated_response: str
            
        # Create state graph with the schema
        workflow = StateGraph(AgentState)
        
        # Define the main processing node
        def process_message(state: AgentState) -> AgentState:
            """Process user message with personality context."""
            try:
                # Extract message and context
                user_message = state.get("message", "")
                context = state.get("context", [])
                
                # Build conversation history
                messages = [SystemMessage(content=self._build_system_prompt())]
                
                # Add context messages if provided
                for ctx_msg in context:
                    if ctx_msg.get("role") == "user":
                        messages.append(HumanMessage(content=ctx_msg.get("content", "")))
                    elif ctx_msg.get("role") == "assistant":
                        messages.append(AIMessage(content=ctx_msg.get("content", "")))
                
                # Add current message
                messages.append(HumanMessage(content=user_message))
                
                # Get response from LLM
                response = self.llm_client.generate_sync(
                    messages=messages,
                    temperature=self.settings.temperature,
                    max_tokens=self.settings.max_context_length
                )
                
                # Update state with response
                state["response"] = response
                state["messages"] = messages
                
                return state
                
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                state["error"] = str(e)
                return state
        
        # Define a validation node
        def validate_response(state: AgentState) -> AgentState:
            """Validate and potentially filter the response."""
            response = state.get("response", "")
            
            # Apply any generation rules if specified
            if self.personality.gen_rules:
                for rule in self.personality.gen_rules:
                    # Simple rule application (can be enhanced)
                    if "no profanity" in rule.lower():
                        # Implement profanity filter
                        pass
                    elif "max length" in rule.lower():
                        # Implement length limit
                        pass
            
            state["validated_response"] = response
            return state
        
        # Add nodes to the graph
        workflow.add_node("process", process_message)
        workflow.add_node("validate", validate_response)
        
        # Define edges
        workflow.add_edge("process", "validate")
        workflow.add_edge("validate", END)
        
        # Set entry point
        workflow.set_entry_point("process")
        
        return workflow.compile()
    
    async def call(
        self, 
        message: str, 
        context: Optional[List[Dict[str, str]]] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Process a message through the agent.
        
        Args:
            message: User's message
            context: Previous conversation context
            
        Returns:
            Tuple of (response, metadata)
        """
        try:
            # Prepare initial state
            initial_state = {
                "message": message,
                "context": context or [],
                "agent_id": self.personality.agent_id,
                "agent_name": self.personality.name
            }
            
            # Run the graph synchronously for now (can be made async later)
            result = self.graph.invoke(initial_state)
            
            # Extract response
            if "error" in result:
                raise Exception(result["error"])
            
            response = result.get("validated_response", "I apologize, but I couldn't process your message.")
            
            # Build metadata
            metadata = {
                "agent_id": self.personality.agent_id,
                "agent_name": self.personality.name,
                "tokens_used": len(response.split()),  # Simple approximation
                "personality_rules_applied": len(self.personality.personality_rules)
            }
            
            # Update memory
            self.memory.save_context(
                {"input": message},
                {"output": response}
            )
            
            return response, metadata
            
        except Exception as e:
            logger.error(f"Error in agent call: {e}")
            error_response = "I apologize, but I encountered an error processing your request."
            error_metadata = {
                "agent_id": self.personality.agent_id,
                "error": str(e)
            }
            return error_response, error_metadata
    
    def get_conversation_history(self) -> List[BaseMessage]:
        """Get the conversation history from memory."""
        return self.memory.chat_memory.messages
    
    def clear_memory(self):
        """Clear the conversation memory."""
        self.memory.clear()
        logger.info(f"Cleared memory for agent {self.personality.agent_id}")


class AgentFactory:
    """Factory for creating LangGraph agents."""
    
    @staticmethod
    def create_agent(
        personality: AgentPersonality,
        llm_client: Any
    ) -> LangGraphAgent:
        """
        Create a new agent instance.
        
        Args:
            personality: Agent personality configuration
            llm_client: Language model client
            
        Returns:
            Configured LangGraphAgent instance
        """
        logger.info(f"Creating agent {personality.agent_id} ({personality.name})")
        return LangGraphAgent(personality, llm_client)