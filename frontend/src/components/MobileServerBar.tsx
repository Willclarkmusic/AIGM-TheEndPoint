import React from "react";
import { FiPlus, FiHome } from "react-icons/fi";

interface MobileServerBarProps {
  servers: { id: string; name: string; icon: string; role?: string }[];
  selectedServer: string | null;
  onServerSelect: (serverId: string | null) => void;
  onCreateServer: () => void;
}

const MobileServerBar: React.FC<MobileServerBarProps> = ({
  servers,
  selectedServer,
  onServerSelect,
  onCreateServer,
}) => {
  return (
    <div className="w-16 bg-gray-900 dark:bg-gray-950 flex flex-col items-center py-4 md:hidden">
      {/* Home Button */}
      <button
        onClick={() => onServerSelect(null)}
        className={`w-12 h-12 bg-yellow-400 dark:bg-yellow-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center mb-4 ${
          selectedServer === null
            ? "shadow-none translate-x-0.5 translate-y-0.5"
            : ""
        }`}
      >
        <FiHome size={20} className="text-black dark:text-white" />
      </button>

      {/* Divider */}
      <div className="h-0.5 bg-gray-700 dark:bg-gray-600 mb-4 w-10" />

      {/* Server List */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => onServerSelect(server.id)}
            className={`w-12 h-12 bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center font-bold relative text-black dark:text-white ${
              selectedServer === server.id
                ? "shadow-none translate-x-0.5 translate-y-0.5"
                : ""
            }`}
          >
            {server.icon}
            {/* Status dot for server */}
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black dark:border-gray-600 rounded-full" />
          </button>
        ))}
      </div>

      {/* Add Server Button */}
      <button 
        onClick={onCreateServer}
        className="w-12 h-12 bg-green-400 dark:bg-green-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center mt-4"
      >
        <FiPlus size={20} className="text-black dark:text-white" />
      </button>
    </div>
  );
};

export default MobileServerBar;