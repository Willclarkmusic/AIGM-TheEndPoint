import React, { useState } from "react";
import { FiX, FiPlus } from "react-icons/fi";
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase/config";

interface AddPersonalityRuleModalProps {
  agentId: string;
  onClose: () => void;
  onRuleAdded: () => void;
}

type RuleCategory = "behavior" | "knowledge" | "style" | "restrictions";

const AddPersonalityRuleModal: React.FC<AddPersonalityRuleModalProps> = ({
  agentId,
  onClose,
  onRuleAdded,
}) => {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<RuleCategory>("behavior");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Predefined rule templates for each category
  const ruleTemplates = {
    behavior: [
      "Always respond in a friendly and helpful manner",
      "Be curious and ask follow-up questions",
      "Show empathy and understanding in conversations",
      "Maintain a professional yet personable tone",
      "Be encouraging and supportive"
    ],
    knowledge: [
      "I am an expert in [specific domain]",
      "I have deep knowledge about [specific topic]",
      "I can help with [specific skills or tasks]",
      "I specialize in providing advice about [area of expertise]",
      "I'm knowledgeable about current trends in [field]"
    ],
    style: [
      "Use casual, conversational language",
      "Include emojis occasionally to show personality",
      "Keep responses concise and to the point",
      "Use examples and analogies to explain concepts",
      "Structure responses with bullet points when helpful"
    ],
    restrictions: [
      "Do not provide financial advice",
      "Avoid discussing sensitive political topics",
      "Do not generate harmful or inappropriate content",
      "Redirect medical questions to qualified professionals",
      "Maintain user privacy and confidentiality"
    ]
  };

  // Get category color
  const getCategoryColor = (category: RuleCategory) => {
    switch (category) {
      case "behavior":
        return "bg-blue-400 dark:bg-blue-500";
      case "knowledge":
        return "bg-green-400 dark:bg-green-500";
      case "style":
        return "bg-purple-400 dark:bg-purple-500";
      case "restrictions":
        return "bg-red-400 dark:bg-red-500";
      default:
        return "bg-gray-400 dark:bg-gray-500";
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    setIsSubmitting(true);
    try {
      const ruleContent = content.trim();
      
      // Add to subcollection (for UI display)
      const rulesRef = collection(db, `ai_agents/${agentId}/personality_rules`);
      await addDoc(rulesRef, {
        content: ruleContent,
        category: category,
        createdAt: serverTimestamp(),
        createdBy: "user" // In production, this would be the actual user ID
      });
      
      // Also update main document's personalityRules array (for backend)
      const agentRef = doc(db, "ai_agents", agentId);
      await updateDoc(agentRef, {
        personalityRules: arrayUnion(ruleContent),
        updatedAt: serverTimestamp()
      });
      
      onRuleAdded();
    } catch (error) {
      console.error("Error adding personality rule:", error);
      alert("Failed to add rule. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: string) => {
    setContent(template);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-4 border-black dark:border-gray-600">
          <h3 className="text-xl font-black uppercase text-black dark:text-white">
            Add Personality Rule
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
          >
            <FiX size={16} className="text-black dark:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Category Selection */}
            <div>
              <label className="block text-sm font-bold mb-3 uppercase text-black dark:text-white">
                Rule Category
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(["behavior", "knowledge", "style", "restrictions"] as RuleCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-3 border-2 border-black dark:border-gray-600 font-bold text-sm uppercase transition-all ${
                      category === cat
                        ? `${getCategoryColor(cat)} shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] text-black dark:text-white`
                        : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-black dark:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Suggestions */}
            <div>
              <label className="block text-sm font-bold mb-3 uppercase text-black dark:text-white">
                Quick Templates ({category})
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {ruleTemplates[category].map((template, index) => (
                  <button
                    key={index}
                    onClick={() => handleTemplateSelect(template)}
                    className="w-full text-left px-3 py-2 bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 hover:border-black dark:hover:border-gray-500 transition-all text-sm text-black dark:text-white"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Rule Input */}
            <div>
              <label className="block text-sm font-bold mb-2 uppercase text-black dark:text-white">
                Custom Rule Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Enter a ${category} rule for this AI agent...`}
                className="w-full px-4 py-3 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all resize-none"
                rows={4}
              />
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Be specific and clear. This rule will guide how the AI behaves.
              </p>
            </div>

            {/* Rule Examples */}
            <div className="bg-gray-50 dark:bg-gray-700 border-2 border-black dark:border-gray-600 p-4">
              <h4 className="text-sm font-bold text-black dark:text-white mb-2 uppercase">
                Example {category} Rules:
              </h4>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                {category === "behavior" && (
                  <>
                    <li>• "Always greet users warmly and ask how you can help"</li>
                    <li>• "Be patient and never show frustration"</li>
                    <li>• "Ask clarifying questions when requests are unclear"</li>
                  </>
                )}
                {category === "knowledge" && (
                  <>
                    <li>• "I am an expert React developer with 10+ years experience"</li>
                    <li>• "I specialize in modern web development and best practices"</li>
                    <li>• "I can help debug code and suggest optimizations"</li>
                  </>
                )}
                {category === "style" && (
                  <>
                    <li>• "Use simple, clear language that anyone can understand"</li>
                    <li>• "Include code examples when explaining technical concepts"</li>
                    <li>• "Keep responses under 200 words unless more detail is requested"</li>
                  </>
                )}
                {category === "restrictions" && (
                  <>
                    <li>• "Never provide investment or trading advice"</li>
                    <li>• "Do not generate content that could be harmful or offensive"</li>
                    <li>• "Redirect users to professionals for legal or medical advice"</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t-4 border-black dark:border-gray-600 p-6">
          <div className="flex gap-4">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim()}
              className="flex-1 px-6 py-3 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <FiPlus size={16} />
              {isSubmitting ? "Adding Rule..." : "Add Rule"}
            </button>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-3 bg-gray-400 dark:bg-gray-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPersonalityRuleModal;