import React, { useState, useCallback } from "react";
import type { User } from "firebase/auth";
import { FiChevronLeft, FiChevronRight, FiUsers, FiFolder } from "react-icons/fi";
import PersonalMediaBucket from "./PersonalMediaBucket";

/**
 * AI Agent interface representing a hired agent
 */
interface AIAgent {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: "chat" | "genai" | "custom";
  isActive: boolean;
}

/**
 * Props for the RightSidebar component
 */
interface RightSidebarProps {
  /** Width of the sidebar in pixels */
  width: number;
  /** Whether the sidebar is collapsed */
  isCollapsed: boolean;
  /** Function to toggle sidebar collapse state */
  onToggleCollapse: () => void;
  /** Current authenticated user */
  user: User;
  /** Minimum width constraint */
  minWidth?: number;
  /** Maximum width constraint */
  maxWidth?: number;
}

/**
 * RightSidebar Component
 * 
 * A foldable right sidebar containing:
 * - AI Team section with hired agents (max 10)
 * - Personal Media Bucket for file management
 * 
 * Features horizontal resizing and collapse functionality.
 */
const RightSidebar: React.FC<RightSidebarProps> = ({
  width,
  isCollapsed,
  onToggleCollapse,
  user,
  minWidth = 280,
  maxWidth = 500,
}) => {
  // Sample AI agents data (will be replaced with real data from Firestore)
  const [aiAgents] = useState<AIAgent[]>([
    {
      id: "agent-1",
      name: "Creative Assistant",
      icon: "🎨",
      color: "#EC4899",
      type: "genai",
      isActive: true,
    },
    {
      id: "agent-2", 
      name: "Code Helper",
      icon: "💻",
      color: "#3B82F6",
      type: "chat",
      isActive: false,
    },
    {
      id: "agent-3",
      name: "Research Bot",
      icon: "📚",
      color: "#10B981",
      type: "chat",
      isActive: true,
    },
  ]);

  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    aiTeam: true,
    mediaBucket: true,
  });

  /**
   * Toggle section expansion
   */
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  /**
   * Handle AI agent click
   */
  const handleAgentClick = useCallback((agent: AIAgent) => {
    console.log("AI Agent clicked:", agent.name);
    // TODO: Implement agent interaction
  }, []);

  /**
   * Render AI agent grid
   */
  const renderAIAgents = () => {
    if (!expandedSections.aiTeam) return null;

    // Create array of 10 slots (max agents)
    const agentSlots = Array.from({ length: 10 }, (_, index) => {
      const agent = aiAgents[index];
      
      if (agent) {
        return (
          <button
            key={agent.id}
            onClick={() => handleAgentClick(agent)}
            className="relative w-12 h-12 bg-white dark:bg-gray-700 border-4 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center group"
            title={agent.name}
          >
            <span className="text-lg">{agent.icon}</span>
            
            {/* Active indicator */}
            {agent.isActive && (
              <div 
                className="absolute -top-1 -right-1 w-3 h-3 border-2 border-black dark:border-gray-600 rounded-full"
                style={{ backgroundColor: agent.color }}
              />
            )}
            
            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              {agent.name}
            </div>
          </button>
        );
      }
      
      // Empty slot
      return (
        <div
          key={`empty-${index}`}
          className="w-12 h-12 bg-gray-100 dark:bg-gray-800 border-4 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center"
        >
          <span className="text-gray-400 dark:text-gray-500 text-lg">+</span>
        </div>
      );
    });

    return (
      <div className="grid grid-cols-5 gap-2 px-4 pb-4">
        {agentSlots}
      </div>
    );
  };

  // Calculate actual width considering collapse state
  const actualWidth = isCollapsed ? 48 : Math.max(minWidth, Math.min(maxWidth, width));

  return (
    <div 
      className="bg-gray-200 dark:bg-gray-800 border-l-2 border-black dark:border-gray-600 flex flex-col relative"
      style={{ width: actualWidth }}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={onToggleCollapse}
        className="absolute -left-6 top-4 w-6 h-8 bg-gray-200 dark:bg-gray-800 border-2 border-r-0 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center z-10"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <FiChevronLeft size={12} className="text-black dark:text-white" />
        ) : (
          <FiChevronRight size={12} className="text-black dark:text-white" />
        )}
      </button>

      {!isCollapsed && (
        <>
          {/* AI Team Section */}
          <div className="border-b-2 border-black dark:border-gray-600">
            {/* Section Header */}
            <button
              onClick={() => toggleSection("aiTeam")}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FiUsers size={16} className="text-black dark:text-white" />
                <span className="font-black text-sm uppercase text-black dark:text-white">
                  AI Team ({aiAgents.length}/10)
                </span>
              </div>
              <div className="text-black dark:text-white">
                {expandedSections.aiTeam ? (
                  <FiChevronRight size={12} />
                ) : (
                  <FiChevronLeft size={12} />
                )}
              </div>
            </button>
            
            {/* AI Agents Grid */}
            {renderAIAgents()}
          </div>

          {/* Personal Media Bucket Section */}
          <div className="flex-1 flex flex-col">
            {/* Section Header */}
            <button
              onClick={() => toggleSection("mediaBucket")}
              className="flex items-center justify-between p-4 text-left hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors border-b-2 border-black dark:border-gray-600"
            >
              <div className="flex items-center gap-2">
                <FiFolder size={16} className="text-black dark:text-white" />
                <span className="font-black text-sm uppercase text-black dark:text-white">
                  Media Bucket
                </span>
              </div>
              <div className="text-black dark:text-white">
                {expandedSections.mediaBucket ? (
                  <FiChevronRight size={12} />
                ) : (
                  <FiChevronLeft size={12} />
                )}
              </div>
            </button>
            
            {/* Personal Media Bucket */}
            {expandedSections.mediaBucket && (
              <div className="flex-1 overflow-hidden">
                <PersonalMediaBucket user={user} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Collapsed State Content */}
      {isCollapsed && (
        <div className="flex flex-col items-center py-4 space-y-4">
          {/* AI Team Icon */}
          <button
            onClick={onToggleCollapse}
            className="w-8 h-8 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
            title="AI Team"
          >
            <FiUsers size={14} className="text-black dark:text-white" />
          </button>
          
          {/* Media Bucket Icon */}
          <button
            onClick={onToggleCollapse}
            className="w-8 h-8 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
            title="Media Bucket"
          >
            <FiFolder size={14} className="text-black dark:text-white" />
          </button>
        </div>
      )}
    </div>
  );
};

export default RightSidebar;