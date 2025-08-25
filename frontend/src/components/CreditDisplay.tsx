import React, { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { FiCreditCard, FiRefreshCw, FiZap } from "react-icons/fi";

interface CreditDisplayProps {
  user: User;
  className?: string;
}

interface UserCredits {
  chat_credits: number;
  gen_ai_credits: number;
  subscription_tier: string;
}

const CreditDisplay: React.FC<CreditDisplayProps> = ({ user, className = "" }) => {
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get AI service URL from environment
  const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8080';

  // Fetch user credits
  const fetchCredits = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = user.uid; // For MVP, use UID as token
      
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/users/credits`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // User not found, initialize them
          await initializeUser();
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const creditsData = await response.json();
      setCredits(creditsData);
    } catch (err) {
      console.error('Error fetching credits:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch credits');
    } finally {
      setLoading(false);
    }
  };

  // Initialize user with default credits
  const initializeUser = async () => {
    try {
      const token = user.uid;
      
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/users/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize user: ${response.status}`);
      }

      const creditsData = await response.json();
      setCredits(creditsData);
      console.log('✅ User initialized with credits:', creditsData);
    } catch (err) {
      console.error('Error initializing user:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize user');
    }
  };

  // Load credits on mount
  useEffect(() => {
    if (user.uid) {
      fetchCredits();
    }
  }, [user.uid]);

  // Refresh credits manually
  const handleRefresh = () => {
    fetchCredits();
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-gray-600 dark:text-gray-400 ${className}`}>
        <FiRefreshCw className="animate-spin" size={16} />
        <span className="text-sm">Loading credits...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-red-600 dark:text-red-400 ${className}`}>
        <FiCreditCard size={16} />
        <span className="text-sm">Credit error</span>
        <button
          onClick={handleRefresh}
          className="text-xs hover:underline"
          title="Retry"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!credits) {
    return (
      <div className={`flex items-center gap-2 text-gray-600 dark:text-gray-400 ${className}`}>
        <FiCreditCard size={16} />
        <span className="text-sm">No credits data</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Chat Credits */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <FiCreditCard 
            size={16} 
            className={`${credits.chat_credits <= 5 ? 'text-red-500' : 'text-blue-500'}`}
          />
          <span className={`text-sm font-bold ${credits.chat_credits <= 5 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
            {credits.chat_credits}
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Chat
        </span>
      </div>

      {/* GenAI Credits */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <FiZap 
            size={16} 
            className={`${credits.gen_ai_credits <= 5 ? 'text-red-500' : 'text-purple-500'}`}
          />
          <span className={`text-sm font-bold ${credits.gen_ai_credits <= 5 ? 'text-red-600 dark:text-red-400' : 'text-purple-600 dark:text-purple-400'}`}>
            {credits.gen_ai_credits}
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          GenAI
        </span>
      </div>

      {/* Refresh Button */}
      <button
        onClick={handleRefresh}
        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        title="Refresh credits"
      >
        <FiRefreshCw size={12} className="text-gray-500 dark:text-gray-400" />
      </button>

      {/* Low Credits Warning */}
      {(credits.chat_credits <= 5 || credits.gen_ai_credits <= 5) && (
        <div className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded border border-red-300 dark:border-red-700">
          Low credits!
        </div>
      )}
    </div>
  );
};

export default CreditDisplay;