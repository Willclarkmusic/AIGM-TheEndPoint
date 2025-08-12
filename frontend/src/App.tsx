import React, { useState, useEffect } from "react";
import type { FormEvent } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { FiLogIn } from "react-icons/fi";
import { FaGoogle, FaGithub } from "react-icons/fa";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  getRedirectResult,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase/config";
import HomeScreen from "./components/HomeScreen";
import ServerTest from "./components/ServerTest";
import { ThemeProvider } from "./contexts/ThemeContext";

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

// Helper function to create user document in Firestore
const createUserDocument = async (
  user: User,
  additionalData: { username?: string } = {}
) => {
  try {
    const userDocRef = doc(db, "users", user.uid);
    const userData = {
      uid: user.uid,
      email: user.email,
      name:
        additionalData.username ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "User",
      credits: 10,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      status: "online",
    };
    await setDoc(userDocRef, userData);
    console.log("User document created successfully");
  } catch (error) {
    console.error("Error creating user document:", error);
  }
};

// Login Component
const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "github") => {
    setError("");
    setLoading(true);

    try {
      const authProvider =
        provider === "google" ? googleProvider : githubProvider;
      
      // Try popup first, fallback to redirect if popup fails
      try {
        const result = await signInWithPopup(auth, authProvider);
        await createUserDocument(result.user);
        navigate("/dashboard");
      } catch (popupError: any) {
        // If popup fails due to COOP or popup blocking, fallback to redirect
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/popup-closed-by-user' ||
            popupError.message?.includes('Cross-Origin-Opener-Policy')) {
          
          console.warn('Popup blocked, falling back to redirect method');
          // Store the current path to redirect back after auth
          sessionStorage.setItem('authRedirectPath', window.location.pathname);
          
          // Use redirect method as fallback
          const { signInWithRedirect } = await import('firebase/auth');
          await signInWithRedirect(auth, authProvider);
          return; // Don't continue, redirect will handle navigation
        }
        throw popupError; // Re-throw if it's not a popup issue
      }
    } catch (error: any) {
      console.error('Social login error:', error);
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-yellow-300 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-8 w-full max-w-md">
        <h1 className="text-4xl font-black text-black dark:text-white mb-8 uppercase">Login</h1>

        {error && (
          <div className="bg-red-500 text-white p-4 mb-6 border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)]">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-6">
          <div>
            <label className="block text-black dark:text-white font-bold mb-2 uppercase">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border-4 border-black dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-black dark:text-white font-bold mb-2 uppercase">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border-4 border-black dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pink-500 dark:bg-pink-600 text-black dark:text-white font-black py-4 px-6 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all uppercase disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FiLogIn size={20} />
            {loading ? "Loading..." : "Login"}
          </button>
        </form>

        <div className="mt-8 space-y-4">
          <button
            onClick={() => handleSocialLogin("google")}
            disabled={loading}
            className="w-full bg-blue-500 dark:bg-blue-600 text-white font-black py-4 px-6 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all uppercase disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FaGoogle size={20} />
            Login with Google
          </button>

          <button
            onClick={() => handleSocialLogin("github")}
            disabled={loading}
            className="w-full bg-gray-800 dark:bg-gray-700 text-white font-black py-4 px-6 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all uppercase disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FaGithub size={20} />
            Login with GitHub
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-black dark:text-white font-bold">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="text-pink-600 dark:text-pink-400 underline hover:text-pink-700 dark:hover:text-pink-300"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

// Signup Component
const SignupPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await createUserDocument(userCredential.user, { username });
      navigate("/dashboard");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignup = async (provider: "google" | "github") => {
    setError("");
    setLoading(true);

    try {
      const authProvider =
        provider === "google" ? googleProvider : githubProvider;
      
      // Try popup first, fallback to redirect if popup fails
      try {
        const result = await signInWithPopup(auth, authProvider);
        await createUserDocument(result.user);
        navigate("/dashboard");
      } catch (popupError: any) {
        // If popup fails due to COOP or popup blocking, fallback to redirect
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/popup-closed-by-user' ||
            popupError.message?.includes('Cross-Origin-Opener-Policy')) {
          
          console.warn('Popup blocked, falling back to redirect method');
          // Store the current path to redirect back after auth
          sessionStorage.setItem('authRedirectPath', window.location.pathname);
          
          // Use redirect method as fallback
          const { signInWithRedirect } = await import('firebase/auth');
          await signInWithRedirect(auth, authProvider);
          return; // Don't continue, redirect will handle navigation
        }
        throw popupError; // Re-throw if it's not a popup issue
      }
    } catch (error: any) {
      console.error('Social signup error:', error);
      setError(error.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-400 dark:bg-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-6 w-full max-w-md">
        <h1 className="text-3xl font-black text-black dark:text-white mb-4 uppercase">
          Sign Up
        </h1>

        {error && (
          <div className="bg-red-500 text-white p-3 mb-4 border-2 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-black dark:text-white font-bold mb-2 uppercase">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border-4 border-black dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-black dark:text-white font-bold mb-2 uppercase">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border-4 border-black dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-black dark:text-white font-bold mb-2 uppercase">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border-4 border-black dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-black dark:text-white font-bold mb-2 uppercase">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border-4 border-black dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 dark:bg-orange-600 text-black dark:text-white font-black py-3 px-4 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all uppercase disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FiLogIn size={18} />
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <div className="mt-4 space-y-3">
          <button
            onClick={() => handleSocialSignup("google")}
            disabled={loading}
            className="w-full bg-blue-500 dark:bg-blue-600 text-white font-black py-3 px-4 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all uppercase disabled:opacity-50 text-sm flex items-center justify-center gap-2"
          >
            <FaGoogle size={18} />
            Sign Up with Google
          </button>

          <button
            onClick={() => handleSocialSignup("github")}
            disabled={loading}
            className="w-full bg-gray-800 dark:bg-gray-700 text-white font-black py-3 px-4 border-4 border-black dark:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all uppercase disabled:opacity-50 text-sm flex items-center justify-center gap-2"
          >
            <FaGithub size={18} />
            Sign Up with GitHub
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-black dark:text-white font-bold text-sm">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-orange-600 dark:text-orange-400 underline hover:text-orange-700 dark:hover:text-orange-300"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

// Dashboard Component - now uses HomeScreen
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle redirect result from social auth
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await createUserDocument(result.user);
          // Clear the stored redirect path
          sessionStorage.removeItem('authRedirectPath');
        }
      } catch (error) {
        console.error('Redirect result error:', error);
      }
    };

    // Handle auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
      } else {
        navigate("/login");
      }
      setLoading(false);
    });

    // Handle redirect result on component mount
    handleRedirectResult();

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-purple-400 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-8 text-center">
          <h2 className="text-2xl font-black mb-4 uppercase text-black dark:text-white">Loading...</h2>
          <p className="text-gray-600 dark:text-gray-300">Setting up your account...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <HomeScreen user={user} />;
};

// Test Page Component for Server Testing
const TestPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (!currentUser) {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-purple-400 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(55,65,81,1)] p-8 text-center">
          <h2 className="text-2xl font-black mb-4 uppercase text-black dark:text-white">Loading...</h2>
          <p className="text-gray-600 dark:text-gray-300">Setting up test environment...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-purple-400 dark:bg-gray-900">
      <div className="container mx-auto">
        <div className="p-4">
          <Link 
            to="/dashboard" 
            className="inline-block mb-4 bg-gray-400 dark:bg-gray-500 text-black dark:text-white font-black py-2 px-4 border-2 border-black dark:border-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(55,65,81,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all uppercase text-decoration-none"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <ServerTest user={user} />
      </div>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/test" element={<TestPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
