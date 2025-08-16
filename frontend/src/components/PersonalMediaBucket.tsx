import React, { useState, useCallback, useRef, useEffect } from "react";
import type { User } from "firebase/auth";
import { 
  FiImage, 
  FiMusic, 
  FiFile, 
  FiChevronDown, 
  FiChevronRight, 
  FiUpload,
  FiTrash2,
  FiDownload,
  FiPlay,
  FiPause
} from "react-icons/fi";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc,
  serverTimestamp,
  orderBy 
} from "firebase/firestore";
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from "firebase/storage";
import { db, storage } from "../firebase/config";

/**
 * Media file interface
 */
interface MediaFile {
  id: string;
  name: string;
  type: "image" | "audio" | "file";
  url: string;
  size: number;
  uploadedAt: any;
  mimeType: string;
  storagePath?: string;
}

/**
 * Props for PersonalMediaBucket component
 */
interface PersonalMediaBucketProps {
  /** Current authenticated user */
  user: User;
}

/**
 * PersonalMediaBucket Component
 * 
 * Accordion-style component for managing user's personal media files.
 * Supports drag-and-drop uploads to Firebase Cloud Storage.
 * 
 * Sections:
 * - Images (jpg, png, gif, webp)
 * - Audio (mp3, wav, ogg)
 * - Files (pdf, txt, doc, etc.)
 */
const PersonalMediaBucket: React.FC<PersonalMediaBucketProps> = ({ user }) => {
  // Media files state organized by type
  const [mediaFiles, setMediaFiles] = useState<{
    images: MediaFile[];
    audio: MediaFile[];
    files: MediaFile[];
  }>({
    images: [],
    audio: [],
    files: [],
  });

  // UI state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    images: true,
    audio: true,
    files: true,
  });
  
  const [dragOverType, setDragOverType] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // File input refs for manual upload
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  /**
   * Load user's media files from Firestore
   */
  useEffect(() => {
    if (!user?.uid) return;

    const mediaQuery = query(
      collection(db, "user_media"),
      where("userId", "==", user.uid),
      orderBy("uploadedAt", "desc")
    );

    const unsubscribe = onSnapshot(mediaQuery, (snapshot) => {
      const images: MediaFile[] = [];
      const audio: MediaFile[] = [];
      const files: MediaFile[] = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as MediaFile;
        const mediaFile = { ...data, id: doc.id };

        switch (data.type) {
          case "image":
            images.push(mediaFile);
            break;
          case "audio":
            audio.push(mediaFile);
            break;
          case "file":
            files.push(mediaFile);
            break;
        }
      });

      setMediaFiles({ images, audio, files });
    });

    return () => unsubscribe();
  }, [user?.uid]);

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
   * Determine file type from MIME type
   */
  const getFileType = (mimeType: string): "image" | "audio" | "file" => {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    return "file";
  };

  /**
   * Validate file type and size
   */
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    
    if (file.size > maxSize) {
      return { valid: false, error: "File size must be less than 10MB" };
    }

    const allowedTypes = [
      // Images
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
      // Audio
      "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg",
      // Files
      "application/pdf", "text/plain", "application/msword", 
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: "File type not supported" };
    }

    return { valid: true };
  };

  /**
   * Upload file to Firebase Storage and save metadata to Firestore
   */
  const uploadFile = async (file: File, targetType?: "image" | "audio" | "file") => {
    const validation = validateFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    // Debug: Log user authentication info
    console.log("Current user:", user);
    console.log("User UID:", user.uid);
    console.log("User email:", user.email);

    const fileType = targetType || getFileType(file.type);
    const fileName = `${Date.now()}_${file.name}`;
    const storagePath = `user_media/${user.uid}/${fileType}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    console.log("Attempting to upload to path:", storagePath);

    setUploading(prev => ({ ...prev, [fileType]: true }));

    try {
      // Upload file to Storage
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      // Save metadata to Firestore
      const mediaDoc = doc(collection(db, "user_media"));
      const docData = {
        userId: user.uid,
        name: file.name,
        type: fileType,
        url: downloadURL,
        size: file.size,
        mimeType: file.type,
        uploadedAt: serverTimestamp(),
        storagePath: uploadResult.ref.fullPath,
      };
      
      console.log("Creating Firestore document with data:", docData);
      console.log("Document ID:", mediaDoc.id);
      
      await setDoc(mediaDoc, docData);

      console.log(`${fileType} uploaded successfully:`, file.name);
      console.log("Firestore document created with ID:", mediaDoc.id);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      
      // More specific error messages
      if (error.code === 'storage/unauthorized') {
        alert("Upload failed: You don't have permission to upload files. Please check if you're logged in.");
      } else if (error.code === 'storage/quota-exceeded') {
        alert("Upload failed: Storage quota exceeded.");
      } else if (error.code === 'storage/invalid-format') {
        alert("Upload failed: Invalid file format.");
      } else {
        alert(`Upload failed: ${error.message || "Please try again."}`);
      }
    } finally {
      setUploading(prev => ({ ...prev, [fileType]: false }));
    }
  };

  /**
   * Delete file from Storage and Firestore
   */
  const deleteFile = async (mediaFile: MediaFile) => {
    if (!confirm(`Delete "${mediaFile.name}"?`)) return;

    try {
      // Delete from Storage using the stored path
      if (mediaFile.storagePath) {
        const storageRef = ref(storage, mediaFile.storagePath);
        await deleteObject(storageRef);
      } else {
        // Fallback to constructed path if storagePath is missing
        const fileName = `${Date.now()}_${mediaFile.name}`;
        const storageRef = ref(storage, `user_media/${user.uid}/${mediaFile.type}/${fileName}`);
        await deleteObject(storageRef);
      }

      // Delete from Firestore
      await deleteDoc(doc(db, "user_media", mediaFile.id));

      console.log("File deleted successfully:", mediaFile.name);
    } catch (error: any) {
      console.error("Error deleting file:", error);
      
      if (error.code === 'storage/object-not-found') {
        // File doesn't exist in storage, just delete from Firestore
        try {
          await deleteDoc(doc(db, "user_media", mediaFile.id));
          console.log("File metadata deleted (file not found in storage):", mediaFile.name);
        } catch (firestoreError) {
          console.error("Error deleting from Firestore:", firestoreError);
          alert("Failed to delete file metadata. Please try again.");
        }
      } else {
        alert("Failed to delete file. Please try again.");
      }
    }
  };

  /**
   * Handle drag over events
   */
  const handleDragOver = useCallback((e: React.DragEvent, type: string) => {
    e.preventDefault();
    setDragOverType(type);
  }, []);

  /**
   * Handle drag leave events
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverType(null);
  }, []);

  /**
   * Handle file drop events
   */
  const handleDrop = useCallback((e: React.DragEvent, targetType: "image" | "audio" | "file") => {
    e.preventDefault();
    setDragOverType(null);

    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => uploadFile(file, targetType));
  }, [user]);

  /**
   * Handle manual file selection
   */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, targetType: "image" | "audio" | "file") => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => uploadFile(file, targetType));
    
    // Reset input
    e.target.value = "";
  }, [user]);

  /**
   * Handle audio playback
   */
  const toggleAudioPlayback = useCallback((audioFile: MediaFile) => {
    if (!audioRef.current) return;

    if (playingAudio === audioFile.id) {
      audioRef.current.pause();
      setPlayingAudio(null);
    } else {
      audioRef.current.src = audioFile.url;
      audioRef.current.play();
      setPlayingAudio(audioFile.id);
    }
  }, [playingAudio]);

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  /**
   * Render file list for a specific type
   */
  const renderFileList = (files: MediaFile[], type: "image" | "audio" | "file") => {
    // Fix section key mapping - audio should use "audio", not "audios"
    const sectionKey = type === "audio" ? "audio" : type + "s";
    if (!expandedSections[sectionKey]) return null;

    const isDragOver = dragOverType === sectionKey;

    return (
      <div
        className={`flex-1 max-h-48 overflow-y-auto border-2 border-dashed transition-colors mx-4 mb-4 ${
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-600"
        }`}
        onDragOver={(e) => handleDragOver(e, sectionKey)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, type)}
      >
        {files.length === 0 ? (
          // Empty state with drop zone
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FiUpload 
              size={24} 
              className="text-gray-400 dark:text-gray-500 mb-2" 
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Drag files here or click to upload
            </p>
            <button
              onClick={() => {
                if (type === "image") imageInputRef.current?.click();
                else if (type === "audio") audioInputRef.current?.click();
                else fileInputRef.current?.click();
              }}
              disabled={uploading[type]}
              className="px-3 py-1 bg-gray-400 dark:bg-gray-500 text-black dark:text-white font-bold text-xs border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase"
            >
              {uploading[type] ? "Uploading..." : "Choose Files"}
            </button>
          </div>
        ) : (
          // File list
          <div className="space-y-2 p-2">
            {files.map((file) => (
              <div
                key={file.id}
                draggable
                onDragStart={(e) => {
                  // Set the file data for drag-and-drop
                  e.dataTransfer.setData("application/json", JSON.stringify(file));
                  e.dataTransfer.effectAllowed = "copy";
                  
                  // Create custom drag image with file icon
                  const dragImage = document.createElement("div");
                  dragImage.className = "flex items-center gap-2 bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-2 rounded font-bold text-sm";
                  dragImage.style.position = "absolute";
                  dragImage.style.top = "-1000px";
                  dragImage.style.zIndex = "1000";
                  
                  // Add appropriate icon based on file type
                  const iconSpan = document.createElement("span");
                  if (file.type === "image") {
                    iconSpan.textContent = "🖼️";
                  } else if (file.type === "audio") {
                    iconSpan.textContent = "🎵";
                  } else {
                    iconSpan.textContent = "📄";
                  }
                  
                  const nameSpan = document.createElement("span");
                  nameSpan.textContent = file.name;
                  nameSpan.className = "text-black dark:text-white";
                  
                  dragImage.appendChild(iconSpan);
                  dragImage.appendChild(nameSpan);
                  document.body.appendChild(dragImage);
                  
                  // Set the custom drag image
                  e.dataTransfer.setDragImage(dragImage, 50, 20);
                  
                  // Clean up the temporary element after a short delay
                  setTimeout(() => {
                    document.body.removeChild(dragImage);
                  }, 0);
                }}
                className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(55,65,81,1)] cursor-grab active:cursor-grabbing hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] transition-all"
                title="Drag to message composer to attach"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* File icon based on type */}
                  {type === "image" && <FiImage size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />}
                  {type === "audio" && <FiMusic size={16} className="text-purple-600 dark:text-purple-400 flex-shrink-0" />}
                  {type === "file" && <FiFile size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-black dark:text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Audio playback button */}
                  {type === "audio" && (
                    <button
                      onClick={() => toggleAudioPlayback(file)}
                      className="w-6 h-6 bg-purple-400 dark:bg-purple-500 border border-black dark:border-gray-600 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                      title={playingAudio === file.id ? "Pause" : "Play"}
                    >
                      {playingAudio === file.id ? (
                        <FiPause size={10} className="text-black dark:text-white" />
                      ) : (
                        <FiPlay size={10} className="text-black dark:text-white" />
                      )}
                    </button>
                  )}

                  {/* Download button */}
                  <a
                    href={file.url}
                    download={file.name}
                    className="w-6 h-6 bg-blue-400 dark:bg-blue-500 border border-black dark:border-gray-600 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                    title="Download"
                  >
                    <FiDownload size={10} className="text-black dark:text-white" />
                  </a>

                  {/* Delete button */}
                  <button
                    onClick={() => deleteFile(file)}
                    className="w-6 h-6 bg-red-400 dark:bg-red-500 border border-black dark:border-gray-600 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center"
                    title="Delete"
                  >
                    <FiTrash2 size={10} className="text-black dark:text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /**
   * Render section header with file count and upload button
   */
  const renderSectionHeader = (title: string, icon: React.ReactNode, count: number, type: "image" | "audio" | "file", sectionKey: string) => (
    <div className="flex items-center justify-between p-3 border-b-2 border-black dark:border-gray-600">
      <button
        onClick={() => toggleSection(sectionKey)}
        className="flex items-center gap-2 flex-1 text-left"
      >
        {icon}
        <span className="font-black text-xs uppercase text-black dark:text-white">
          {title} ({count})
        </span>
        <div className="text-black dark:text-white ml-auto">
          {expandedSections[sectionKey] ? (
            <FiChevronDown size={12} />
          ) : (
            <FiChevronRight size={12} />
          )}
        </div>
      </button>
      
      {expandedSections[sectionKey] && (
        <button
          onClick={() => {
            if (type === "image") imageInputRef.current?.click();
            else if (type === "audio") audioInputRef.current?.click();
            else fileInputRef.current?.click();
          }}
          disabled={uploading[type]}
          className="ml-2 w-6 h-6 bg-green-400 dark:bg-green-500 border border-black dark:border-gray-600 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          title="Upload files"
        >
          <FiUpload size={10} className="text-black dark:text-white" />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800">
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e, "image")}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e, "audio")}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.doc,.docx"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e, "file")}
      />

      {/* Hidden audio element for playback */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingAudio(null)}
        onError={() => setPlayingAudio(null)}
      />

      {/* Images Section */}
      <div className="border-b-2 border-black dark:border-gray-600">
        {renderSectionHeader(
          "Images",
          <FiImage size={14} className="text-green-600 dark:text-green-400" />,
          mediaFiles.images.length,
          "image",
          "images"
        )}
        {renderFileList(mediaFiles.images, "image")}
      </div>

      {/* Audio Section */}
      <div className="border-b-2 border-black dark:border-gray-600">
        {renderSectionHeader(
          "Audio",
          <FiMusic size={14} className="text-purple-600 dark:text-purple-400" />,
          mediaFiles.audio.length,
          "audio",
          "audio"
        )}
        {renderFileList(mediaFiles.audio, "audio")}
      </div>

      {/* Files Section */}
      <div className="flex-1 flex flex-col">
        {renderSectionHeader(
          "Files",
          <FiFile size={14} className="text-blue-600 dark:text-blue-400" />,
          mediaFiles.files.length,
          "file",
          "files"
        )}
        {renderFileList(mediaFiles.files, "file")}
      </div>
    </div>
  );
};

export default PersonalMediaBucket;