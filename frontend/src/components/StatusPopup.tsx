import React, { useState } from "react";
import { FiX } from "react-icons/fi";

interface StatusPopupProps {
  currentStatus: string;
  customStatus: { title: string; color: string } | null;
  onStatusChange: (status: string, custom?: { title: string; color: string } | null) => void;
  onClose: () => void;
  leftPosition?: number;
}

const StatusPopup: React.FC<StatusPopupProps> = ({
  currentStatus,
  customStatus,
  onStatusChange,
  onClose,
  leftPosition = 64,
}) => {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState(customStatus?.title || "");
  const [customColor, setCustomColor] = useState(customStatus?.color || "#9333EA");

  const statusOptions = [
    { value: "online", label: "Online", color: "bg-green-500" },
    { value: "idle", label: "Idle", color: "bg-yellow-500" },
    { value: "away", label: "Away", color: "bg-red-500" },
  ];

  const colorOptions = [
    "#10B981", // green
    "#F59E0B", // yellow
    "#EF4444", // red
    "#9333EA", // purple
    "#3B82F6", // blue
    "#EC4899", // pink
    "#8B5CF6", // violet
    "#6366F1", // indigo
  ];

  const handleCustomStatus = () => {
    if (customTitle.trim()) {
      onStatusChange("custom", { title: customTitle, color: customColor });
    }
  };

  return (
    <div 
      className="absolute bottom-0 ml-2 bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-4 z-50 w-64"
      style={{ left: `${leftPosition}px` }}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-black text-lg uppercase text-black dark:text-white">Status</h3>
        <button
          onClick={onClose}
          className="w-6 h-6 bg-red-400 dark:bg-red-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
        >
          <FiX size={14} className="text-black dark:text-white" />
        </button>
      </div>

      {/* Preset Status Options */}
      <div className="space-y-2 mb-4">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onStatusChange(option.value);
              setShowCustomForm(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 border-2 border-black dark:border-gray-600 ${
              currentStatus === option.value && !customStatus
                ? "bg-gray-200 dark:bg-gray-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            } transition-all`}
          >
            <div className={`w-3 h-3 ${option.color} border border-black rounded-full`} />
            <span className="font-bold text-black dark:text-white">{option.label}</span>
          </button>
        ))}

        {/* Custom Status Button */}
        <button
          onClick={() => setShowCustomForm(!showCustomForm)}
          className={`w-full flex items-center gap-3 px-3 py-2 border-2 border-black dark:border-gray-600 ${
            currentStatus === "custom" && customStatus
              ? "bg-gray-200 dark:bg-gray-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
              : "hover:bg-gray-100 dark:hover:bg-gray-700"
          } transition-all`}
        >
          <div
            className="w-3 h-3 border border-black rounded-full"
            style={{ backgroundColor: customStatus?.color || customColor }}
          />
          <span className="font-bold text-black dark:text-white">
            {customStatus ? customStatus.title : "Custom Status"}
          </span>
        </button>
      </div>

      {/* Custom Status Form */}
      {showCustomForm && (
        <div className="border-t-2 border-black dark:border-gray-600 pt-4 space-y-3">
          <div>
            <label className="block text-sm font-bold mb-1 uppercase text-black dark:text-white">Status Text</label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Enter custom status..."
              className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1 uppercase text-black dark:text-white">Color</label>
            <div className="grid grid-cols-4 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  onClick={() => setCustomColor(color)}
                  className={`w-10 h-10 border-2 border-black dark:border-gray-600 ${
                    customColor === color
                      ? "shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)]"
                      : "hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)]"
                  } transition-all`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleCustomStatus}
            disabled={!customTitle.trim()}
            className="w-full bg-purple-400 dark:bg-purple-500 text-black dark:text-white font-bold py-2 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase"
          >
            Set Custom Status
          </button>
        </div>
      )}
    </div>
  );
};

export default StatusPopup;