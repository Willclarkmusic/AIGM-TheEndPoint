import React, { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { FiX, FiTrash2, FiFolder } from "react-icons/fi";
import PersonalMediaBucket from "./PersonalMediaBucket";

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

interface AITeamMember {
  id: string;
  agentId: string;
  name: string;
  description: string;
  adoptedAt: any;
  serverId?: string;
  roomId?: string;
}


const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const [activeSection, setActiveSection] = useState<"ai-team" | "media">("ai-team");
  const [aiTeam, setAiTeam] = useState<AITeamMember[]>([]);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  // Load user's AI team
  useEffect(() => {
    if (!user.uid || !isOpen) {
      setAiTeam([]);
      return;
    }

    const teamRef = collection(db, `users/${user.uid}/ai_team`);
    const teamQuery = query(teamRef, orderBy("adoptedAt", "desc"));

    const unsubscribe = onSnapshot(teamQuery, (snapshot) => {
      const team: AITeamMember[] = [];
      snapshot.forEach((doc) => {
        team.push({
          id: doc.id,
          ...doc.data()
        } as AITeamMember);
      });
      setAiTeam(team);
    });

    return () => unsubscribe();
  }, [user.uid, isOpen]);


  // Remove AI from team
  const handleRemoveAI = async (agentId: string) => {
    if (!confirm("Remove this AI agent from your team?")) return;
    
    setIsRemoving(agentId);
    try {
      const teamMemberRef = doc(db, `users/${user.uid}/ai_team/${agentId}`);
      await deleteDoc(teamMemberRef);
      console.log("AI agent removed from team");
    } catch (error) {
      console.error("Error removing AI from team:", error);
      alert("Failed to remove AI agent. Please try again.");
    } finally {
      setIsRemoving(null);
    }
  };

  // Get AI agent icon/avatar
  const getAIIcon = (name: string, index: number) => {
    // Generate a consistent color based on the agent name
    const colors = [
      "bg-red-400", "bg-blue-400", "bg-green-400", "bg-yellow-400", 
      "bg-purple-400", "bg-pink-400", "bg-indigo-400", "bg-orange-400"
    ];
    const colorIndex = name.length % colors.length;
    
    return (
      <div className={`w-12 h-12 ${colors[colorIndex]} border-2 border-black dark:border-gray-600 flex items-center justify-center font-black text-black dark:text-white text-lg`}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="h-full bg-white dark:bg-gray-800 border-l-4 border-black dark:border-gray-600 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-100 dark:bg-gray-700 border-b-4 border-black dark:border-gray-600 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black uppercase text-black dark:text-white">
            AI & Media
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
          >
            <FiX size={16} className="text-black dark:text-white" />
          </button>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="bg-gray-50 dark:bg-gray-700 border-b-2 border-black dark:border-gray-600 p-2">
        <div className="flex gap-0">
          <button
            onClick={() => setActiveSection("ai-team")}
            className={`flex-1 py-2 px-3 font-bold text-xs border-2 border-black dark:border-gray-600 transition-all uppercase text-black dark:text-white ${
              activeSection === "ai-team"
                ? "bg-purple-400 dark:bg-purple-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                : "bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500"
            }`}
          >
            🤖 AI Team
          </button>
          <button
            onClick={() => setActiveSection("media")}
            className={`flex-1 py-2 px-3 font-bold text-xs border-2 border-black dark:border-gray-600 border-l-0 transition-all uppercase text-black dark:text-white ${
              activeSection === "media"
                ? "bg-blue-400 dark:bg-blue-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                : "bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500"
            }`}
          >
            <FiFolder size={12} className="inline mr-1" />
            Media
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === "ai-team" ? (
          // AI Team Section
          <div className="p-4">
            <div className="mb-4">
              <h4 className="text-sm font-black uppercase text-black dark:text-white mb-2">
                Your AI Team ({aiTeam.length}/10)
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                AI agents you've adopted from various servers
              </p>
            </div>

            {aiTeam.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {aiTeam.map((agent, index) => (
                  <div
                    key={agent.id}
                    className="bg-gray-100 dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] p-3 group hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer relative"
                  >
                    {/* AI Icon */}
                    <div className="flex flex-col items-center">
                      {getAIIcon(agent.name, index)}
                      <p className="text-xs font-bold text-black dark:text-white mt-2 text-center truncate w-full">
                        {agent.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                        {agent.description && agent.description.length > 20 
                          ? `${agent.description.substring(0, 20)}...` 
                          : agent.description || "AI Assistant"}
                      </p>
                    </div>

                    {/* Remove Button - Shows on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAI(agent.agentId);
                      }}
                      disabled={isRemoving === agent.agentId}
                      className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 border-2 border-black dark:border-gray-600 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center disabled:opacity-50"
                    >
                      <FiTrash2 size={10} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                <div className="text-4xl mb-4">🤖</div>
                <h4 className="text-sm font-bold mb-2">No AI Agents Yet</h4>
                <p className="text-xs mb-4">
                  Visit AI Agent rooms and click "Adopt AI" to add agents to your team
                </p>
                <div className="bg-purple-100 dark:bg-purple-900 border-2 border-purple-400 p-3">
                  <p className="text-xs text-purple-800 dark:text-purple-200">
                    <strong>Tip:</strong> You can have up to 10 AI agents in your personal team
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Media Bucket Section - Using PersonalMediaBucket component
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b-2 border-black dark:border-gray-600">
              <h4 className="text-sm font-black uppercase text-black dark:text-white mb-2">
                Your Media Bucket
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Images, audio files, and documents you've uploaded
              </p>
            </div>
            <div className="flex-1 min-h-0">
              <PersonalMediaBucket user={user} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-100 dark:bg-gray-700 border-t-4 border-black dark:border-gray-600 p-4">
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {activeSection === "ai-team" 
              ? `${aiTeam.length}/10 AI agents in your team`
              : "Media bucket with drag & drop upload support"
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;