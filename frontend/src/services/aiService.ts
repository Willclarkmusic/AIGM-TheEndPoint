import { auth } from "../firebase/config";

// AI Service API Types
export interface ChatRequest {
  user_id: string;
  agent_id: string;
  message: string;
  context?: string;
  room_id?: string;
  server_id?: string;
}

export interface ChatResponse {
  message: string;
  agent_id: string;
  tokens_used: number;
  credits_remaining: number;
}

export interface AIServiceError {
  detail: string;
  status_code?: number;
}

class AIServiceClient {
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8080';
  }

  /**
   * Get Firebase ID token for authentication
   */
  private async getAuthToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // For MVP backend, send user ID as token
      // The backend expects the token to BE the user ID for now
      // TODO: Update backend to properly decode Firebase ID tokens
      return user.uid;
      
      // In production, use this:
      // const token = await user.getIdToken();
      // return token;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Make authenticated request to AI service
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData: AIServiceError = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
        status_code: response.status
      }));

      throw new Error(errorData.detail || 'AI service request failed');
    }

    return response.json();
  }

  /**
   * Send chat message to AI agent
   */
  async chatCall(request: ChatRequest): Promise<ChatResponse> {
    try {
      console.log('🤖 Sending chat request to AI service:', {
        agent_id: request.agent_id,
        message_length: request.message.length,
        room_id: request.room_id
      });

      const response = await this.makeRequest<ChatResponse>('/api/v1/chat-call', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      console.log('✅ AI service response received:', {
        tokens_used: response.tokens_used,
        credits_remaining: response.credits_remaining,
        response_length: response.message.length
      });

      return response;
    } catch (error) {
      console.error('❌ AI service chat call failed:', error);
      throw error;
    }
  }

  /**
   * Get AI agent information
   */
  async getAgentInfo(agentId: string) {
    try {
      return await this.makeRequest(`/api/v1/chat/agents/${agentId}`);
    } catch (error) {
      console.error('Failed to get agent info:', error);
      throw error;
    }
  }

  /**
   * Test connection to AI service
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch (error) {
      console.error('AI service connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const aiService = new AIServiceClient();

// Export error handling utilities
export const isAuthError = (error: any): boolean => {
  return error?.message?.includes('authentication') || 
         error?.message?.includes('Unauthorized') ||
         error?.message?.includes('token');
};

export const isCreditError = (error: any): boolean => {
  return error?.message?.includes('credit') ||
         error?.message?.includes('Insufficient');
};

export const isRateLimitError = (error: any): boolean => {
  return error?.message?.includes('rate limit') ||
         error?.message?.includes('Too Many Requests');
};