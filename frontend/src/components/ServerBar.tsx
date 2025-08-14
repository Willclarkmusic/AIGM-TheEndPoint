import React, { useState, useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import { FiHome, FiPlus, FiSettings, FiSun, FiMoon, FiLogOut } from "react-icons/fi";
import { doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebase/config";
import StatusPopup from "./StatusPopup";
import { useTheme } from "../contexts/ThemeContext";

interface ServerBarProps {
  width: number;
  user: User;
  userStatus: string;
  customStatus: { title: string; color: string } | null;
  onServerSelect: (serverId: string | null) => void;
  selectedServer: string | null;
  onStatusChange: (status: string) => void;
  onCustomStatusChange: (
    custom: { title: string; color: string } | null
  ) => void;
  servers: { id: string; name: string; icon: string; role: string }[];
  onCreateServer: () => void;
}

const ServerBar: React.FC<ServerBarProps> = ({
  width,
  user,
  userStatus,
  customStatus,
  onServerSelect,
  selectedServer,
  onStatusChange,
  onCustomStatusChange,
  servers,
  onCreateServer,
}) => {
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const [hoveredServer, setHoveredServer] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const settingsRef = useRef<HTMLDivElement>(null);

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

  // Update user status in Firestore
  const updateUserStatus = async (
    status: string,
    custom?: { title: string; color: string } | null
  ) => {
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        status: status,
        customStatus: custom || null,
      });
      onStatusChange(status);
      if (custom) {
        onCustomStatusChange(custom);
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // Handle clicks outside settings popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node)
      ) {
        setShowSettingsPopup(false);
      }
    };

    if (showSettingsPopup) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSettingsPopup]);

  // Calculate icon size based on width
  const iconSize = width >= 80 ? 48 : 44; // Smaller icons for narrower sidebar

  return (
    <div
      className="bg-gray-900 dark:bg-gray-950 flex flex-col items-center py-4 relative "
      style={{ width: `${width}px` }}
    >
      {/* Home Button */}
      <button
        onClick={() => onServerSelect(null)}
        style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
        className={`bg-yellow-400 dark:bg-yellow-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center mb-4 ${
          selectedServer === null
            ? "shadow-none translate-x-0.5 translate-y-0.5"
            : ""
        }`}
      >
        <FiHome size={20} className="text-black dark:text-white" />
      </button>

      {/* Divider */}
      <div
        className="h-0.5 bg-gray-700 dark:bg-gray-600 mb-4"
        style={{ width: `${width - 24}px` }}
      />

      {/* Server List */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto overflow-x-hidden w-full  items-center">
        {servers.map((server) => (
          <div key={server.id} className="relative">
            <button
              onClick={() => onServerSelect(server.id)}
              onMouseEnter={() => setHoveredServer(server.id)}
              onMouseLeave={() => setHoveredServer(null)}
              style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
              className={`bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center font-bold relative text-black dark:text-white ${
                selectedServer === server.id
                  ? "shadow-none translate-x-0.5 translate-y-0.5"
                  : ""
              }`}
            >
              {server.icon}
              {/* Status dot for server */}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black dark:border-gray-600 rounded-full" />
            </button>

            {/* Server Name Hover Popup */}
            {hoveredServer === server.id && (
              <div
                className="absolute z-50 bg-black dark:bg-gray-900 text-white px-3 py-2 text-sm font-bold border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] whitespace-nowrap pointer-events-none"
                style={{
                  left: `${width + 8}px`,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                {server.name}
                {/* Arrow pointing to server icon */}
                <div
                  className="absolute w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-black dark:border-r-gray-900"
                  style={{
                    left: "-8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Icons */}
      <div className="flex flex-col gap-3 mt-4">
        {/* Add Server Button */}
        <button
          onClick={onCreateServer}
          style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
          className="bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
        >
          <FiPlus size={20} className="text-black dark:text-white" />
        </button>

        {/* Settings Button */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettingsPopup(!showSettingsPopup)}
            style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
            className="bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
          >
            <FiSettings size={20} className="text-black dark:text-white" />
          </button>

          {/* Settings Popup */}
          {showSettingsPopup && (
            <div
              className="absolute bottom-0 ml-2 bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-4 z-50 min-w-48"
              style={{ left: `${width}px` }}
            >
              <button
                onClick={() => {
                  console.log("Theme button clicked!");
                  toggleTheme();
                  setShowSettingsPopup(false);
                }}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-black dark:text-white rounded flex items-center gap-2"
              >
                {theme === "light" ? (
                  <FiMoon size={16} className="text-black dark:text-white" />
                ) : (
                  <FiSun size={16} className="text-black dark:text-white" />
                )}
                {theme === "light" ? "Light" : "Dark"}
              </button>
              <button
                onClick={() => console.log("More settings")}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-black dark:text-white rounded"
              >
                Account Settings
              </button>
              <button
                onClick={() => console.log("Server settings")}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-black dark:text-white rounded"
              >
                Server Settings
              </button>
              <hr className="my-2 border-gray-300 dark:border-gray-600" />
              <button
                onClick={async () => {
                  try {
                    await signOut(auth);
                    console.log("User signed out");
                  } catch (error) {
                    console.error("Error signing out:", error);
                  }
                  setShowSettingsPopup(false);
                }}
                className="block w-full text-left px-4 py-2 hover:bg-red-100 dark:hover:bg-red-900 font-bold text-red-600 dark:text-red-400 rounded flex items-center gap-2"
              >
                <FiLogOut size={16} />
                Log Out
              </button>
            </div>
          )}
        </div>

        {/* User Profile Button */}
        <div className="relative">
          <button
            onClick={() => setShowStatusPopup(!showStatusPopup)}
            style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
            className="bg-pink-400 dark:bg-pink-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center font-bold relative text-black dark:text-white"
          >
            {user.email?.[0].toUpperCase() || "U"}
            {/* Status indicator dot */}
            <div
              className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusColor()} border-2 border-black dark:border-gray-600 rounded-full`}
            />
          </button>

          {/* Status Popup */}
          {showStatusPopup && (
            <StatusPopup
              currentStatus={userStatus}
              customStatus={customStatus}
              onStatusChange={(status, custom) => {
                updateUserStatus(status, custom);
                setShowStatusPopup(false);
              }}
              onClose={() => setShowStatusPopup(false)}
              leftPosition={width}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ServerBar;
