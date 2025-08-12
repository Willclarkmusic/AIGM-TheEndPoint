import React from "react";
import { FiUser, FiSettings } from "react-icons/fi";
import type { User } from "firebase/auth";

interface MobileFooterProps {
  user: User;
  userStatus: string;
  customStatus: { title: string; color: string } | null;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  selectedTab: "profile" | "settings" | null;
}

const MobileFooter: React.FC<MobileFooterProps> = ({
  userStatus,
  customStatus,
  onProfileClick,
  onSettingsClick,
  selectedTab,
}) => {
  // Get status color
  const getStatusColor = () => {
    if (customStatus) return customStatus.color;
    switch (userStatus) {
      case "online":
        return "bg-green-500";
      case "idle":
        return "bg-yellow-500";
      case "away":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t-4 border-black dark:border-gray-600 flex justify-around items-center h-16 z-40 md:hidden">
      {/* Profile Button */}
      <button
        onClick={onProfileClick}
        className={`flex flex-col items-center justify-center px-6 py-2 transition-all relative ${
          selectedTab === "profile"
            ? "text-pink-600 dark:text-pink-400"
            : "text-gray-600 dark:text-gray-400"
        }`}
      >
        <div className="relative">
          <FiUser size={24} />
          {/* Status indicator dot */}
          <div
            className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor()} border-2 border-white dark:border-gray-900 rounded-full`}
          />
        </div>
        <span className="text-xs font-bold mt-1">Profile</span>
      </button>

      {/* Settings Button */}
      <button
        onClick={onSettingsClick}
        className={`flex flex-col items-center justify-center px-6 py-2 transition-all ${
          selectedTab === "settings"
            ? "text-purple-600 dark:text-purple-400"
            : "text-gray-600 dark:text-gray-400"
        }`}
      >
        <FiSettings size={24} />
        <span className="text-xs font-bold mt-1">Settings</span>
      </button>
    </div>
  );
};

export default MobileFooter;