import React from "react";
import { FiMenu, FiX } from "react-icons/fi";

interface MobileHeaderProps {
  title: string;
  showSidebar: boolean;
  onToggleSidebar: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  showSidebar,
  onToggleSidebar,
}) => {
  return (
    <div className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-900 border-b-4 border-black dark:border-gray-600 flex items-center justify-between px-4 h-16 z-40 md:hidden">
      {/* Hamburger Menu Button */}
      <button
        onClick={onToggleSidebar}
        className="w-10 h-10 bg-yellow-400 dark:bg-yellow-500 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
      >
        {showSidebar ? (
          <FiX size={20} className="text-black dark:text-white" />
        ) : (
          <FiMenu size={20} className="text-black dark:text-white" />
        )}
      </button>

      {/* Title */}
      <h1 className="text-xl font-black uppercase text-black dark:text-white">
        {title}
      </h1>

      {/* Spacer for balance */}
      <div className="w-10" />
    </div>
  );
};

export default MobileHeader;