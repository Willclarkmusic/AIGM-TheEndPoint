import React, { useState, useRef, KeyboardEvent } from "react";
import type { User } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { FiSend } from "react-icons/fi";

interface MessageComposerProps {
  serverId: string;
  roomId: string;
  user: User;
  disabled?: boolean;
}

const MessageComposer: React.FC<MessageComposerProps> = ({
  serverId,
  roomId,
  user,
  disabled = false,
}) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Send message function
  const sendMessage = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending || disabled) return;

    setSending(true);

    try {
      const messagesRef = collection(
        db,
        `servers/${serverId}/chat_rooms/${roomId}/messages`
      );

      await addDoc(messagesRef, {
        text: trimmedMessage,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        senderEmail: user.email || "",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      // Clear the input
      setMessage("");
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Error sending message:", error);
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

  return (
    <div className="border-t-4 border-black dark:border-gray-600 bg-gray-100 dark:bg-gray-800 p-4">
      <div
        className="max-w-4xl mx-auto"
        style={{ maxWidth: "1000px" }}
      >
        <div className="flex gap-3 items-end">
          {/* Message Input */}
          <div className="flex-1">
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
              disabled={disabled || sending}
              rows={1}
              className={`w-full px-4 py-3 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all resize-none overflow-hidden font-medium leading-tight ${
                disabled 
                  ? "opacity-50 cursor-not-allowed" 
                  : ""
              }`}
              style={{
                minHeight: "48px",
                maxHeight: "200px", // Increased max height for better multi-line support
                lineHeight: "1.4",
              }}
            />
          </div>

          {/* Send Button - Aligned to bottom of textarea */}
          <button
            onClick={sendMessage}
            disabled={!message.trim() || sending || disabled}
            className="w-12 h-12 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:hover:translate-x-0 disabled:hover:translate-y-0 flex-shrink-0"
            title="Send message"
          >
            <FiSend 
              size={16} 
              className={`text-black dark:text-white ${
                sending ? "opacity-50" : ""
              }`} 
            />
          </button>
        </div>

        {/* Helper Text */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          {disabled ? (
            "You need to be a member of this server to send messages"
          ) : (
            <>
              Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs">Enter</kbd> to send, 
              <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs ml-1">Shift + Enter</kbd> for new line
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageComposer;