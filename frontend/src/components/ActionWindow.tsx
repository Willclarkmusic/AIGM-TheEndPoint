import React from "react";
import type { User } from "firebase/auth";
import { FiSidebar, FiArrowLeft } from "react-icons/fi";
import ServerSettings from "./ServerSettings";
import ChatRoom from "./ChatRoom";

interface ActionWindowProps {
  selectedServer: string | null;
  selectedTab: "friends" | "feed";
  user: User;
  showServerSettings?: boolean;
  selectedServerData?: {
    id: string;
    name: string;
    role: "owner" | "admin" | "member" | null;
  } | null;
  selectedRoom?: {
    id: string;
    name: string;
    serverId: string;
  } | null;
  onBackFromServerSettings?: () => void;
  onServerDeleted?: () => void;
}

const ActionWindow: React.FC<ActionWindowProps> = ({
  selectedServer,
  selectedTab,
  user,
  showServerSettings = false,
  selectedServerData,
  selectedRoom,
  onBackFromServerSettings,
  onServerDeleted,
}) => {
  const getTitle = () => {
    if (showServerSettings && selectedServerData) {
      return "Server Settings";
    }
    if (selectedRoom) {
      return selectedRoom.name;
    }
    if (selectedServer) {
      return `Server ${selectedServer}`;
    }
    return selectedTab === "friends" ? "Friends" : "Social Feed";
  };

  const getContent = () => {
    // Show ServerSettings when requested
    if (showServerSettings && selectedServerData && selectedServerData.role) {
      return (
        <ServerSettings
          serverId={selectedServerData.id}
          serverName={selectedServerData.name}
          user={user}
          userRole={selectedServerData.role}
          onServerDeleted={onServerDeleted}
        />
      );
    }

    // Show ChatRoom when a room is selected
    if (selectedRoom) {
      return (
        <ChatRoom
          serverId={selectedRoom.serverId}
          roomId={selectedRoom.id}
          roomName={selectedRoom.name}
          user={user}
        />
      );
    }

    if (selectedServer) {
      return (
        <div className="text-center">
          <h2 className="text-2xl font-black mb-4 uppercase text-black dark:text-white">Server {selectedServer}</h2>
          <p className="text-gray-600 dark:text-gray-400">Select a room from the sidebar to start chatting.</p>
        </div>
      );
    }

    if (selectedTab === "friends") {
      return (
        <div className="text-center">
          <h2 className="text-2xl font-black mb-4 uppercase text-black dark:text-white">Add a Friend</h2>
          <div className="max-w-md mx-auto">
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Search for friends by their username or email address.
            </p>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter username or email..."
                className="w-full px-4 py-3 border-4 border-black dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] transition-all text-lg"
              />
              <button className="w-full bg-blue-400 dark:bg-blue-500 text-black dark:text-white font-black py-3 px-6 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all uppercase">
                Search Users
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center">
        <h2 className="text-2xl font-black mb-4 uppercase text-black dark:text-white">Social Feed</h2>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-8 mb-6">
            <h3 className="text-xl font-black mb-4 uppercase text-black dark:text-white">Create a Post</h3>
            <textarea
              placeholder="What's on your mind?"
              className="w-full px-4 py-3 border-2 border-black dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] transition-all resize-none"
              rows={4}
            />
            <div className="flex justify-between items-center mt-4">
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold uppercase text-black dark:text-white">
                  Image
                </button>
                <button className="px-4 py-2 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold uppercase text-black dark:text-white">
                  AI Art
                </button>
              </div>
              <button className="px-6 py-2 bg-pink-400 dark:bg-pink-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold uppercase text-black dark:text-white">
                Post
              </button>
            </div>
          </div>
          
          <div className="text-gray-600 dark:text-gray-400">
            <p>No posts to display yet.</p>
            <p className="mt-2">Start following users or tags to see content in your feed!</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col">
      {/* Top Bar */}
      <div className="bg-gray-800 dark:bg-gray-950 text-white px-6 py-4 border-b-4 border-black dark:border-gray-600 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showServerSettings && onBackFromServerSettings && (
            <button 
              onClick={onBackFromServerSettings}
              className="w-10 h-10 bg-gray-600 dark:bg-gray-700 border-2 border-black dark:border-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
            >
              <FiArrowLeft size={18} className="text-white" />
            </button>
          )}
          <h1 className="text-xl font-black uppercase">{getTitle()}</h1>
        </div>
        <button className="w-10 h-10 bg-gray-600 dark:bg-gray-700 border-2 border-black dark:border-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center">
          <FiSidebar size={18} className="text-white" />
        </button>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col ${showServerSettings || selectedRoom ? 'overflow-hidden' : 'overflow-y-auto p-8'}`}>
        {getContent()}
      </div>

      {/* Welcome Message */}
      {!selectedServer && (
        <div className="p-6 bg-gray-100 dark:bg-gray-800 border-t-4 border-black dark:border-gray-600">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Welcome back, <span className="font-bold text-black dark:text-white">{user.email}</span>! 
            Select a server or explore your friends and social feed.
          </p>
        </div>
      )}
    </div>
  );
};

export default ActionWindow;