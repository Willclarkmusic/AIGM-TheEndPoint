import React, { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { 
  doc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  where,
  getDocs,
  setDoc
} from "firebase/firestore";
import { db } from "../firebase/config";
import { FiEdit, FiMessageCircle, FiPlus, FiSend, FiStar } from "react-icons/fi";
import MessageLog from "./MessageLog";
import MessageComposer from "./MessageComposer";
import PersonalityRuleCard from "./PersonalityRuleCard";
import AddPersonalityRuleModal from "./AddPersonalityRuleModal";
import { aiService } from "../services/aiService";

// AI Service types (defined inline to avoid module import issues)
interface ChatRequest {
  user_id: string;
  agent_id: string;
  message: string;
  context?: string;
  room_id?: string;
  server_id?: string;
}

interface AIRoomProps {
  serverId: string;
  roomId: string;
  roomName: string;
  user: User;
}

interface RoomData {
  name: string;
  type: "ai-agent-design";
  createdAt: any;
  createdBy: string;
  agentId?: string;
  isPublic?: boolean;
}

interface PersonalityRule {
  id: string;
  content: string;
  category: "behavior" | "knowledge" | "style" | "restrictions";
  createdAt: any;
  createdBy: string;
}

interface AIAgent {
  id: string;
  agentId: string;
  name: string;
  description: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: any;
  personalityRules: PersonalityRule[];
}

interface TestChatMessage {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: any;
}

const AIRoom: React.FC<AIRoomProps> = ({
  serverId,
  roomId,
  roomName,
  user,
}) => {
  const [activeTab, setActiveTab] = useState<"edit" | "chat">("chat");
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [userRole, setUserRole] = useState<"owner" | "admin" | "member">("member");
  const [aiAgent, setAiAgent] = useState<AIAgent | null>(null);
  const [personalityRules, setPersonalityRules] = useState<PersonalityRule[]>([]);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Test chat state
  const [testChatMessages, setTestChatMessages] = useState<TestChatMessage[]>([]);
  const [testChatInput, setTestChatInput] = useState("");
  const [isTestChatting, setIsTestChatting] = useState(false);
  
  // AI adoption state
  const [isAdopted, setIsAdopted] = useState(false);
  const [isAdopting, setIsAdopting] = useState(false);

  // Load room data and user role
  useEffect(() => {
    const loadRoomAndUserData = async () => {
      if (!serverId || !roomId || !user.uid) return;

      setLoading(true);
      setError(null);

      try {
        // Load room data
        const roomRef = doc(db, `servers/${serverId}/chat_rooms/${roomId}`);
        const roomDoc = await getDoc(roomRef);

        if (!roomDoc.exists()) {
          setError("AI Agent room not found");
          setLoading(false);
          return;
        }

        const roomData = roomDoc.data() as RoomData;
        setRoomData(roomData);

        // Load user's role in this server
        const memberRef = doc(db, `servers/${serverId}/members/${user.uid}`);
        const memberDoc = await getDoc(memberRef);

        if (memberDoc.exists()) {
          const memberData = memberDoc.data();
          setUserRole(memberData.role || "member");
        } else {
          setError("You are not a member of this server");
          setLoading(false);
          return;
        }

        // Load or create AI agent for this room
        await loadOrCreateAIAgent(roomData);
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading AI room data:", error);
        setError("Failed to load AI room data");
        setLoading(false);
      }
    };

    loadRoomAndUserData();
  }, [serverId, roomId, user.uid]);

  // Load or create AI agent
  const loadOrCreateAIAgent = async (roomData: RoomData) => {
    try {
      if (roomData.agentId) {
        // Load existing agent
        const agentRef = doc(db, `ai_agents/${roomData.agentId}`);
        const agentDoc = await getDoc(agentRef);
        
        if (agentDoc.exists()) {
          const agentData = agentDoc.data();
          setAiAgent({
            id: agentDoc.id,
            agentId: agentData.agentId || agentDoc.id,
            name: agentData.name || roomName,
            description: agentData.description || "",
            isPublic: agentData.isPublic || false,
            createdBy: agentData.createdBy,
            createdAt: agentData.createdAt,
            personalityRules: []
          });
        }
      } else {
        // Create new agent for this room
        const agentRef = doc(collection(db, "ai_agents"));
        const newAgent = {
          agentId: agentRef.id,
          name: roomName,
          description: `AI agent for ${roomName}`,
          isPublic: false,
          ownerId: user.uid, // Backend expects ownerId, not createdBy
          createdBy: user.uid, // Keep for frontend compatibility
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          serverId: serverId,
          roomId: roomId,
          personalityRules: [], // Backend expects this array
          genRules: [] // Optional generation rules
        };
        
        await setDoc(agentRef, newAgent);
        
        // Update room with agent ID
        await updateDoc(doc(db, `servers/${serverId}/chat_rooms/${roomId}`), {
          agentId: agentRef.id
        });
        
        setAiAgent({
          id: agentRef.id,
          agentId: agentRef.id,
          name: newAgent.name,
          description: newAgent.description,
          isPublic: newAgent.isPublic,
          createdBy: newAgent.createdBy,
          createdAt: newAgent.createdAt,
          personalityRules: []
        });
      }
    } catch (error) {
      console.error("Error loading/creating AI agent:", error);
    }
  };

  // Load personality rules
  useEffect(() => {
    if (!aiAgent?.id) {
      setPersonalityRules([]);
      return;
    }

    const rulesRef = collection(db, `ai_agents/${aiAgent.id}/personality_rules`);
    const rulesQuery = query(rulesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(rulesQuery, (snapshot) => {
      const rules: PersonalityRule[] = [];
      snapshot.forEach((doc) => {
        rules.push({
          id: doc.id,
          ...doc.data()
        } as PersonalityRule);
      });
      setPersonalityRules(rules);
    });

    return () => unsubscribe();
  }, [aiAgent?.id]);

  // Temporary migration function
  const migrateAgentData = async () => {
    if (!aiAgent?.id) return;
    
    try {
      console.log("Starting agent migration...");
      
      // Collect all personality rules content
      const rulesContent = personalityRules.map(rule => rule.content);
      
      // Update agent document with backend-expected fields
      const agentRef = doc(db, "ai_agents", aiAgent.id);
      await updateDoc(agentRef, {
        ownerId: user.uid, // Add ownerId field
        personalityRules: rulesContent, // Add array of rules
        updatedAt: serverTimestamp()
      });
      
      console.log("Agent migration completed successfully!");
      alert("Agent data migrated successfully!");
    } catch (error) {
      console.error("Migration error:", error);
      alert("Migration failed. Check console for details.");
    }
  };

  // Check if user has adopted this AI
  useEffect(() => {
    const checkAdoptionStatus = async () => {
      if (!user.uid || !aiAgent?.agentId) return;
      
      try {
        const userTeamRef = collection(db, `users/${user.uid}/ai_team`);
        const teamQuery = query(userTeamRef, where("agentId", "==", aiAgent.agentId));
        const teamSnapshot = await getDocs(teamQuery);
        
        setIsAdopted(!teamSnapshot.empty);
      } catch (error) {
        console.error("Error checking adoption status:", error);
      }
    };

    checkAdoptionStatus();
  }, [user.uid, aiAgent?.agentId]);

  // Handle adopt AI
  const handleAdoptAI = async () => {
    if (!aiAgent || isAdopting) return;
    
    setIsAdopting(true);
    try {
      // Check if user already has 10 AI agents
      const userTeamRef = collection(db, `users/${user.uid}/ai_team`);
      const teamSnapshot = await getDocs(userTeamRef);
      
      if (teamSnapshot.size >= 10) {
        alert("You can only have up to 10 AI agents in your team. Remove one to adopt this AI.");
        return;
      }
      
      // Add AI to user's team
      const teamMemberRef = doc(userTeamRef, aiAgent.agentId);
      await setDoc(teamMemberRef, {
        agentId: aiAgent.agentId,
        name: aiAgent.name,
        description: aiAgent.description,
        adoptedAt: serverTimestamp(),
        serverId: serverId,
        roomId: roomId
      });
      
      setIsAdopted(true);
      console.log("AI agent adopted successfully");
    } catch (error) {
      console.error("Error adopting AI:", error);
      alert("Failed to adopt AI agent. Please try again.");
    } finally {
      setIsAdopting(false);
    }
  };

  // Handle test chat
  const handleTestChat = async () => {
    if (!testChatInput.trim() || isTestChatting || !aiAgent) return;
    
    setIsTestChatting(true);
    const userMessage = testChatInput.trim();
    setTestChatInput("");
    
    // Add user message
    const userMsgId = Date.now().toString();
    setTestChatMessages(prev => [...prev, {
      id: userMsgId,
      content: userMessage,
      sender: "user",
      timestamp: new Date()
    }]);
    
    try {
      // Call real AI service
      const chatRequest: ChatRequest = {
        user_id: user.uid,
        agent_id: aiAgent.agentId,
        message: userMessage,
        room_id: roomId,
        server_id: serverId,
      };

      console.log("🧪 Test chat calling AI service...");
      const response = await aiService.chatCall(chatRequest);
      
      const aiMsgId = (Date.now() + 1).toString();
      setTestChatMessages(prev => [...prev, {
        id: aiMsgId,
        content: response.message,
        sender: "ai",
        timestamp: new Date()
      }]);

      console.log(`✅ Test chat response received (${response.tokens_used} tokens, ${response.credits_remaining} credits remaining)`);

    } catch (error) {
      console.error("❌ Test chat AI service error:", error);
      
      let errorMessage = "Failed to get AI response. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('credit')) {
          errorMessage = "Insufficient credits for AI response.";
        } else if (error.message.includes('authentication')) {
          errorMessage = "Authentication error. Please refresh and try again.";
        } else if (error.message.includes('rate limit')) {
          errorMessage = "Rate limit exceeded. Please wait before testing again.";
        }
      }

      setTestChatMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        content: `⚠️ ${errorMessage}`,
        sender: "ai",
        timestamp: new Date()
      }]);
    } finally {
      setIsTestChatting(false);
    }
  };

  // Check if user can edit (owner, admin, or designated editor)
  const canEdit = userRole === "owner" || userRole === "admin";

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="text-gray-600 dark:text-gray-400 mb-2">
            Loading AI Agent room...
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-500">
            {roomName}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-2 font-bold">
            {error}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-500">
            {roomName}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col h-full min-h-0">
      {/* Tab Navigation */}
      <div className="bg-gray-100 dark:bg-gray-800 border-b-4 border-black dark:border-gray-600 p-4">
        <div className="flex gap-0 max-w-md">
          {canEdit && (
            <button
              onClick={() => setActiveTab("edit")}
              className={`flex-1 py-3 px-4 font-black text-sm border-2 border-black dark:border-gray-600 transition-all uppercase text-black dark:text-white flex items-center justify-center gap-2 ${
                activeTab === "edit"
                  ? "bg-purple-400 dark:bg-purple-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                  : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
            >
              <FiEdit size={16} />
              Edit
            </button>
          )}
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-3 px-4 font-black text-sm border-2 border-black dark:border-gray-600 transition-all uppercase text-black dark:text-white flex items-center justify-center gap-2 ${
              canEdit ? "border-l-0" : ""
            } ${
              activeTab === "chat"
                ? "bg-blue-400 dark:bg-blue-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <FiMessageCircle size={16} />
            AI Chat
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === "edit" && canEdit ? (
          // Edit Tab - Only visible to owners, admins, or designated editors
          <div className="flex-1 flex h-full min-h-0">
            {/* Left Panel - Personality Rules */}
            <div className="flex-1 flex flex-col min-h-0 border-r-4 border-black dark:border-gray-600">
              <div className="bg-gray-50 dark:bg-gray-800 border-b-2 border-black dark:border-gray-600 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black uppercase text-black dark:text-white">
                      Personality Rules
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Define how this AI agent behaves and responds
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddRuleModal(true)}
                      className="px-4 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white flex items-center gap-2"
                    >
                      <FiPlus size={16} />
                      Add Rule
                    </button>
                    {/* Temporary migration button */}
                    <button
                      onClick={migrateAgentData}
                      className="px-4 py-2 bg-orange-400 dark:bg-orange-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white text-sm"
                      title="Migrate agent data for backend compatibility"
                    >
                      Migrate Agent
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <div className="space-y-4">
                  {personalityRules.length > 0 ? (
                    personalityRules.map((rule) => (
                      <PersonalityRuleCard
                        key={rule.id}
                        rule={rule}
                        agentId={aiAgent?.id || ""}
                        canEdit={canEdit}
                        onRuleUpdated={() => {
                          // Rules will update via real-time listener
                        }}
                        onRuleDeleted={() => {
                          // Rules will update via real-time listener
                        }}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                      <div className="text-4xl mb-4">🤖</div>
                      <h4 className="text-lg font-bold mb-2">No Personality Rules Yet</h4>
                      <p className="text-sm mb-4">
                        Add rules to define how this AI agent behaves and responds to users.
                      </p>
                      <button
                        onClick={() => setShowAddRuleModal(true)}
                        className="px-6 py-3 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white"
                      >
                        Create First Rule
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Test Chat */}
            <div className="w-80 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-800">
              <div className="bg-gray-100 dark:bg-gray-700 border-b-2 border-black dark:border-gray-600 p-4">
                <h4 className="text-md font-black uppercase text-black dark:text-white">
                  Test Chat
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Test your AI agent in real-time
                </p>
              </div>
              
              <div className="flex-1 flex flex-col min-h-0">
                {/* Test Chat Messages */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                  <div className="space-y-3 min-h-full flex flex-col">
                    {testChatMessages.length > 0 ? (
                      <>
                        <div className="flex-1"></div>
                        {testChatMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-xs px-3 py-2 border-2 border-black dark:border-gray-600 ${
                                message.sender === "user"
                                  ? "bg-blue-400 dark:bg-blue-500 text-black dark:text-white"
                                  : "bg-gray-200 dark:bg-gray-600 text-black dark:text-white"
                              }`}
                            >
                              <p className="text-sm">{message.content}</p>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center text-gray-500 dark:text-gray-400">
                          <div className="text-2xl mb-2">💭</div>
                          <p className="text-sm">Start a test conversation with your AI</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Test Chat Input */}
                <div className="border-t-2 border-black dark:border-gray-600 p-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testChatInput}
                      onChange={(e) => setTestChatInput(e.target.value)}
                      placeholder="Test message..."
                      className="flex-1 px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all text-sm"
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleTestChat();
                        }
                      }}
                      disabled={isTestChatting}
                    />
                    <button
                      onClick={handleTestChat}
                      disabled={!testChatInput.trim() || isTestChatting}
                      className="px-3 py-2 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiSend size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // AI Chat Tab - Standard messaging interface with Adopt AI button
          <div className="flex-1 flex flex-col">
            {/* Adopt AI Button - Only show if not adopted and is public or user has access */}
            {!isAdopted && (aiAgent?.isPublic || canEdit) && (
              <div className="bg-yellow-100 dark:bg-yellow-900 border-b-4 border-black dark:border-gray-600 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-black dark:text-white">
                      🤖 {aiAgent?.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Add this AI agent to your personal team
                    </p>
                  </div>
                  <button
                    onClick={handleAdoptAI}
                    disabled={isAdopting}
                    className="px-6 py-3 bg-orange-400 dark:bg-orange-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <FiStar size={16} />
                    {isAdopting ? "Adopting..." : "Adopt AI"}
                  </button>
                </div>
              </div>
            )}
            
            {/* Standard Chat Interface */}
            <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col min-h-0 max-h-[calc(100vh-150px)]">
              <MessageLog
                serverId={serverId}
                roomId={roomId}
                user={user}
                userRole={userRole}
              />
              <div className="flex-shrink-0">
                <MessageComposer
                  serverId={serverId}
                  roomId={roomId}
                  user={user}
                  disabled={false}
                  roomType="ai-agent-design"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Personality Rule Modal */}
      {showAddRuleModal && aiAgent && (
        <AddPersonalityRuleModal
          agentId={aiAgent.id}
          onClose={() => setShowAddRuleModal(false)}
          onRuleAdded={() => {
            setShowAddRuleModal(false);
            // Rules will update via real-time listener
          }}
        />
      )}
    </div>
  );
};

export default AIRoom;