import React, { useState } from "react";
import { FiEdit2, FiTrash2, FiSave, FiX } from "react-icons/fi";
import { doc, updateDoc, deleteDoc, serverTimestamp, getDoc, arrayRemove, arrayUnion } from "firebase/firestore";
import { db } from "../firebase/config";

interface PersonalityRule {
  id: string;
  content: string;
  category: "behavior" | "knowledge" | "style" | "restrictions";
  createdAt: any;
  createdBy: string;
}

interface PersonalityRuleCardProps {
  rule: PersonalityRule;
  agentId: string;
  canEdit: boolean;
  onRuleUpdated: () => void;
  onRuleDeleted: () => void;
}

const PersonalityRuleCard: React.FC<PersonalityRuleCardProps> = ({
  rule,
  agentId,
  canEdit,
  onRuleUpdated,
  onRuleDeleted,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(rule.content);
  const [editCategory, setEditCategory] = useState(rule.category);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "behavior":
        return "bg-blue-100 dark:bg-blue-900 border-blue-400 text-blue-800 dark:text-blue-200";
      case "knowledge":
        return "bg-green-100 dark:bg-green-900 border-green-400 text-green-800 dark:text-green-200";
      case "style":
        return "bg-purple-100 dark:bg-purple-900 border-purple-400 text-purple-800 dark:text-purple-200";
      case "restrictions":
        return "bg-red-100 dark:bg-red-900 border-red-400 text-red-800 dark:text-red-200";
      default:
        return "bg-gray-100 dark:bg-gray-900 border-gray-400 text-gray-800 dark:text-gray-200";
    }
  };

  // Handle save rule
  const handleSave = async () => {
    if (!editContent.trim()) return;
    
    setIsSaving(true);
    try {
      const newContent = editContent.trim();
      
      // Update subcollection (for UI)
      const ruleRef = doc(db, `ai_agents/${agentId}/personality_rules/${rule.id}`);
      await updateDoc(ruleRef, {
        content: newContent,
        category: editCategory,
        updatedAt: serverTimestamp(),
      });
      
      // Update main document's array (for backend)
      const agentRef = doc(db, "ai_agents", agentId);
      await updateDoc(agentRef, {
        personalityRules: arrayRemove(rule.content), // Remove old content
        updatedAt: serverTimestamp()
      });
      await updateDoc(agentRef, {
        personalityRules: arrayUnion(newContent), // Add new content
      });
      
      setIsEditing(false);
      onRuleUpdated();
    } catch (error) {
      console.error("Error updating personality rule:", error);
      alert("Failed to update rule. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete rule
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this personality rule?")) {
      return;
    }
    
    setIsDeleting(true);
    try {
      // Delete from subcollection (UI)
      const ruleRef = doc(db, `ai_agents/${agentId}/personality_rules/${rule.id}`);
      await deleteDoc(ruleRef);
      
      // Remove from main document's array (backend)
      const agentRef = doc(db, "ai_agents", agentId);
      await updateDoc(agentRef, {
        personalityRules: arrayRemove(rule.content),
        updatedAt: serverTimestamp()
      });
      
      onRuleDeleted();
    } catch (error) {
      console.error("Error deleting personality rule:", error);
      alert("Failed to delete rule. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle cancel edit
  const handleCancel = () => {
    setEditContent(rule.content);
    setEditCategory(rule.category);
    setIsEditing(false);
  };

  return (
    <div className="bg-white dark:bg-gray-700 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] p-4">
      {/* Category Badge */}
      <div className="flex items-start justify-between mb-3">
        <div className={`px-3 py-1 border-2 ${getCategoryColor(rule.category)} font-bold text-xs uppercase tracking-wide`}>
          {rule.category}
        </div>
        
        {canEdit && !isEditing && (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 bg-yellow-400 dark:bg-yellow-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              title="Edit Rule"
            >
              <FiEdit2 size={14} className="text-black dark:text-white" />
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete Rule"
            >
              <FiTrash2 size={14} className="text-black dark:text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Rule Content */}
      {isEditing ? (
        <div className="space-y-3">
          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase">
              Category
            </label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as any)}
              className="w-full px-2 py-1 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white text-sm"
            >
              <option value="behavior">Behavior</option>
              <option value="knowledge">Knowledge</option>
              <option value="style">Style</option>
              <option value="restrictions">Restrictions</option>
            </select>
          </div>
          
          {/* Content Editor */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase">
              Rule Content
            </label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all resize-none text-sm"
              rows={3}
              placeholder="Enter personality rule..."
            />
          </div>
          
          {/* Edit Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !editContent.trim()}
              className="flex-1 px-3 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <FiSave size={12} />
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex-1 px-3 py-2 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <FiX size={12} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-black dark:text-white leading-relaxed">
            {rule.content}
          </p>
          {rule.createdAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Created {new Date(rule.createdAt.seconds * 1000).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PersonalityRuleCard;