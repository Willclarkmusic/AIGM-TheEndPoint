import React, { useState, useRef, KeyboardEvent } from "react";
import type { User } from "firebase/auth";
import { addDoc, collection, serverTimestamp, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { FiSend, FiSmile, FiLoader } from "react-icons/fi";
import EmojiPicker from "./EmojiPicker";
import { aiService, isAuthError, isCreditError, isRateLimitError } from "../services/aiService";

// AI Service types (defined inline to avoid module import issues)
interface ChatRequest {
  user_id: string;
  agent_id: string;
  message: string;
  context?: string;
  room_id?: string;
  server_id?: string;
}

interface MessageComposerProps {
  serverId: string;
  roomId: string;
  user: User;
  disabled?: boolean;
  roomType?: "chat" | "genai" | "ai-agent-design";
  onCreditsUpdated?: (credits: {chat_credits: number, gen_ai_credits: number}) => void;
}

const MessageComposer: React.FC<MessageComposerProps> = ({
  serverId,
  roomId,
  user,
  disabled = false,
  roomType,
  onCreditsUpdated,
}) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [aiResponding, setAiResponding] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // Get AI agent ID for AI rooms
  const getAIAgentId = async (): Promise<string | null> => {
    if (roomType !== "ai-agent-design") return null;
    
    try {
      const roomRef = doc(db, `servers/${serverId}/chat_rooms/${roomId}`);
      const roomDoc = await getDoc(roomRef);
      
      if (roomDoc.exists()) {
        const roomData = roomDoc.data();
        return roomData.agentId || null;
      }
    } catch (error) {
      console.error("Failed to get AI agent ID:", error);
    }
    
    return null;
  };

  // Generate AI response
  const generateAIResponse = async (userMessage: string, agentId: string) => {
    setAiResponding(true);
    
    try {
      const chatRequest: ChatRequest = {
        user_id: user.uid,
        agent_id: agentId,
        message: userMessage,
        room_id: roomId,
        server_id: serverId,
      };

      const response = await aiService.chatCall(chatRequest);
      
      // Add AI response to chat
      const messagesRef = collection(
        db,
        `servers/${serverId}/chat_rooms/${roomId}/messages`
      );

      await addDoc(messagesRef, {
        text: response.message,
        senderId: "ai-agent",
        senderName: "AI Agent",
        senderEmail: "",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        isAiResponse: true,
        agentId: agentId,
        tokensUsed: response.tokens_used,
        creditsRemaining: response.credits_remaining,
      });

      console.log(`🤖 AI response generated (${response.tokens_used} tokens, ${response.credits_remaining} credits remaining)`);

      // Notify parent component about credit update
      if (onCreditsUpdated) {
        onCreditsUpdated({
          chat_credits: response.credits_remaining,
          gen_ai_credits: response.credits_remaining // For now, assume same - will be corrected later
        });
      }

    } catch (error) {
      console.error("❌ AI response generation failed:", error);
      
      // Show user-friendly error messages
      let errorMessage = "AI response failed. Please try again.";
      
      if (isAuthError(error)) {
        errorMessage = "Authentication error. Please refresh and try again.";
      } else if (isCreditError(error)) {
        errorMessage = "Insufficient credits for AI response.";
      } else if (isRateLimitError(error)) {
        errorMessage = "Rate limit exceeded. Please wait before sending another message.";
      }

      // Add error message to chat
      const messagesRef = collection(
        db,
        `servers/${serverId}/chat_rooms/${roomId}/messages`
      );

      await addDoc(messagesRef, {
        text: `⚠️ ${errorMessage}`,
        senderId: "system",
        senderName: "System",
        senderEmail: "",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        isSystemMessage: true,
      });

    } finally {
      setAiResponding(false);
    }
  };

  // Send message function
  const sendMessage = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending || disabled || aiResponding) return;

    setSending(true);
    const startTime = performance.now();
    console.log("💬 Starting message send...");

    // Optimistic UI update - clear input immediately
    const originalMessage = message;
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const messagesRef = collection(
        db,
        `servers/${serverId}/chat_rooms/${roomId}/messages`
      );

      const writeStart = performance.now();
      
      // Send user message
      await addDoc(messagesRef, {
        text: trimmedMessage,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        senderEmail: user.email || "",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      
      const writeTime = performance.now() - writeStart;
      const totalTime = performance.now() - startTime;
      
      console.log(`📤 Message sent successfully in ${totalTime.toFixed(2)}ms (write: ${writeTime.toFixed(2)}ms)`);

      // Generate AI response if this is an AI agent room
      if (roomType === "ai-agent-design") {
        const agentId = await getAIAgentId();
        if (agentId) {
          // Don't await - let AI response happen asynchronously
          generateAIResponse(trimmedMessage, agentId);
        } else {
          console.warn("No AI agent ID found for AI room");
        }
      }

    } catch (error) {
      const errorTime = performance.now() - startTime;
      console.error(`❌ Message send failed after ${errorTime.toFixed(2)}ms:`, error);
      
      // Revert optimistic update on error
      setMessage(originalMessage);
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      }
      
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (but allow Shift+Enter for new lines)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      
      // Insert emoji at cursor position
      const newValue = message.substring(0, startPos) + emoji + message.substring(endPos);
      setMessage(newValue);
      
      // Restore cursor position after emoji
      setTimeout(() => {
        if (textarea) {
          const newCursorPos = startPos + emoji.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
          
          // Auto-resize after emoji insertion
          textarea.style.height = "auto";
          textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
      }, 0);
    }
    
    // Don't close the emoji picker - keep it open for multiple selections
  };

  // Toggle emoji picker
  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  return (
    <div className="border-t-4 border-black dark:border-gray-600 bg-gray-100 dark:bg-gray-800 p-4">
      <div
        className="max-w-4xl mx-auto"
        style={{ maxWidth: "1000px" }}
      >
        <div className="flex gap-3 items-end">
          {/* Message Input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                disabled 
                  ? "You don't have permission to send messages" 
                  : "Type a message... (Enter to send, Shift+Enter for new line)"
              }
              disabled={disabled || sending || aiResponding}
              rows={1}
              className={`w-full px-4 py-3 pr-12 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all resize-none overflow-hidden font-medium leading-tight ${
                disabled || aiResponding 
                  ? "opacity-50 cursor-not-allowed" 
                  : ""
              }`}
              style={{
                minHeight: "48px",
                maxHeight: "200px", // Increased max height for better multi-line support
                lineHeight: "1.4",
              }}
            />
            
            {/* Emoji Button - Inside textarea */}
            <button
              ref={emojiButtonRef}
              onClick={toggleEmojiPicker}
              disabled={disabled || sending || aiResponding}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-yellow-400 dark:bg-yellow-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              title="Add emoji"
              type="button"
            >
              <FiSmile size={14} className="text-black dark:text-white hover:translate-x-0.5 hover:translate-y-0.5 transition-transform" />
            </button>
          </div>

          {/* Send Button - Aligned to bottom of textarea */}
          <button
            onClick={sendMessage}
            disabled={!message.trim() || sending || disabled || aiResponding}
            className="w-12 h-12 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:hover:translate-x-0 disabled:hover:translate-y-0 flex-shrink-0"
            title={aiResponding ? "AI is responding..." : "Send message"}
          >
            {aiResponding ? (
              <FiLoader size={16} className="text-black dark:text-white animate-spin" />
            ) : (
              <FiSend 
                size={16} 
                className={`text-black dark:text-white ${
                  sending ? "opacity-50" : ""
                }`} 
              />
            )}
          </button>
        </div>
        
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
            anchorRef={emojiButtonRef}
          />
        )}

        {/* Helper Text */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          {aiResponding ? (
            <div className="flex items-center justify-center gap-2">
              <FiLoader className="animate-spin" size={12} />
              <span>🤖 AI is generating response...</span>
            </div>
          ) : disabled ? (
            "You need to be a member of this server to send messages"
          ) : (
            <>
              Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs">Enter</kbd> to send, 
              <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs ml-1">Shift + Enter</kbd> for new line
              {roomType === "ai-agent-design" && (
                <span className="ml-2 text-purple-600 dark:text-purple-400">• AI responses enabled</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageComposer;