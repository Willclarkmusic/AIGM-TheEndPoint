import React, { useState } from "react";
import { FiDatabase, FiCheck, FiX, FiHash, FiTrendingUp } from "react-icons/fi";
import { migrateUsersAddSubscribedTags } from "../utils/migrateUsers";
import { createMasterTagsCollection, recalculateTagCounts } from "../utils/migrateTags";

/**
 * AdminMigration Component
 * 
 * A simple admin interface to run database migrations.
 * This should only be accessible to administrators.
 */
const AdminMigration: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningTags, setIsRunningTags] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  const [result, setResult] = useState<{
    success: boolean;
    migrated: number;
    error?: any;
  } | null>(null);
  
  const [tagsResult, setTagsResult] = useState<{
    success: boolean;
    tagsCreated: number;
    error?: any;
  } | null>(null);
  
  const [recalcResult, setRecalcResult] = useState<{
    success: boolean;
    updated: number;
    error?: any;
  } | null>(null);

  const runMigration = async () => {
    if (!confirm("Are you sure you want to run the user migration? This will add subscribedTags field to all users.")) {
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const migrationResult = await migrateUsersAddSubscribedTags();
      setResult(migrationResult);
    } catch (error) {
      setResult({
        success: false,
        migrated: 0,
        error,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runTagsMigration = async () => {
    if (!confirm("Are you sure you want to create the master tags collection? This will process all existing posts and extract tags.")) {
      return;
    }

    setIsRunningTags(true);
    setTagsResult(null);

    try {
      const migrationResult = await createMasterTagsCollection();
      setTagsResult(migrationResult);
    } catch (error) {
      setTagsResult({
        success: false,
        tagsCreated: 0,
        error,
      });
    } finally {
      setIsRunningTags(false);
    }
  };

  const runRecalculation = async () => {
    if (!confirm("Are you sure you want to recalculate tag counts? This will update all tag documents with current usage counts.")) {
      return;
    }

    setIsRecalculating(true);
    setRecalcResult(null);

    try {
      const recalcResult = await recalculateTagCounts();
      setRecalcResult(recalcResult);
    } catch (error) {
      setRecalcResult({
        success: false,
        updated: 0,
        error,
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(55,65,81,1)] p-6">
        <h2 className="text-2xl font-black uppercase text-black dark:text-white mb-6">
          Database Migration
        </h2>

        <div className="mb-6">
          <h3 className="text-lg font-bold text-black dark:text-white mb-2">
            User Tags Migration
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This migration will add the <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1">subscribedTags</code> field to all existing user documents.
          </p>

          <button
            onClick={runMigration}
            disabled={isRunning}
            className="px-6 py-3 bg-blue-400 dark:bg-blue-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FiDatabase size={20} />
            {isRunning ? "Running Migration..." : "Run Migration"}
          </button>
        </div>

        {result && (
          <div
            className={`p-4 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] ${
              result.success
                ? "bg-green-400 dark:bg-green-500"
                : "bg-red-400 dark:bg-red-500"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <FiCheck size={20} className="text-black dark:text-white" />
              ) : (
                <FiX size={20} className="text-white" />
              )}
              <h4 className="font-bold text-black dark:text-white">
                {result.success ? "Migration Successful" : "Migration Failed"}
              </h4>
            </div>
            <p className="text-black dark:text-white">
              {result.success
                ? `Updated ${result.migrated} user(s) successfully.`
                : "An error occurred during migration."}
            </p>
            {result.error && (
              <pre className="mt-2 text-sm bg-white bg-opacity-20 p-2 rounded overflow-x-auto">
                {JSON.stringify(result.error, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Tags Collection Migration */}
        <div className="mb-6 pt-6 border-t-2 border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-bold text-black dark:text-white mb-2">
            Tags Collection Migration
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This migration will create a master <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1">tags</code> collection by extracting and aggregating all tags from existing posts.
          </p>

          <div className="flex gap-3 mb-4">
            <button
              onClick={runTagsMigration}
              disabled={isRunningTags}
              className="px-6 py-3 bg-purple-400 dark:bg-purple-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FiHash size={20} />
              {isRunningTags ? "Creating Tags Collection..." : "Create Tags Collection"}
            </button>

            <button
              onClick={runRecalculation}
              disabled={isRecalculating}
              className="px-6 py-3 bg-orange-400 dark:bg-orange-500 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all font-bold text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FiTrendingUp size={20} />
              {isRecalculating ? "Recalculating..." : "Recalculate Tag Counts"}
            </button>
          </div>

          {tagsResult && (
            <div
              className={`p-4 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] mb-4 ${
                tagsResult.success
                  ? "bg-green-400 dark:bg-green-500"
                  : "bg-red-400 dark:bg-red-500"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {tagsResult.success ? (
                  <FiCheck size={20} className="text-black dark:text-white" />
                ) : (
                  <FiX size={20} className="text-white" />
                )}
                <h4 className="font-bold text-black dark:text-white">
                  {tagsResult.success ? "Tags Migration Successful" : "Tags Migration Failed"}
                </h4>
              </div>
              <p className="text-black dark:text-white">
                {tagsResult.success
                  ? `Created ${tagsResult.tagsCreated} tag document(s) successfully.`
                  : "An error occurred during tags migration."}
              </p>
              {tagsResult.error && (
                <pre className="mt-2 text-sm bg-white bg-opacity-20 p-2 rounded overflow-x-auto">
                  {JSON.stringify(tagsResult.error, null, 2)}
                </pre>
              )}
            </div>
          )}

          {recalcResult && (
            <div
              className={`p-4 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] ${
                recalcResult.success
                  ? "bg-green-400 dark:bg-green-500"
                  : "bg-red-400 dark:bg-red-500"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {recalcResult.success ? (
                  <FiCheck size={20} className="text-black dark:text-white" />
                ) : (
                  <FiX size={20} className="text-white" />
                )}
                <h4 className="font-bold text-black dark:text-white">
                  {recalcResult.success ? "Recalculation Successful" : "Recalculation Failed"}
                </h4>
              </div>
              <p className="text-black dark:text-white">
                {recalcResult.success
                  ? `Updated ${recalcResult.updated} tag count(s) successfully.`
                  : "An error occurred during recalculation."}
              </p>
              {recalcResult.error && (
                <pre className="mt-2 text-sm bg-white bg-opacity-20 p-2 rounded overflow-x-auto">
                  {JSON.stringify(recalcResult.error, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMigration;