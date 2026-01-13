* lib/auth.ts
 * 
 * Authentication utilities for BFC Chat
 */

const WORDPRESS_URL = 'https://bestfitcoach.com';
const AUTH_STORAGE_KEY = 'bfc_auth';

export interface BFCAuthData {
  user_id: string;
  wp_user_id: number;
  name: string;
  email: string;
  subscription_status: string;
  authenticated_at: string;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const authData = getStoredAuth();
  return authData !== null && authData.user_id !== undefined;
}

/**
 * Get stored auth data from localStorage
 */
export function getStoredAuth(): BFCAuthData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    
    const data = JSON.parse(stored) as BFCAuthData;
    return data;
  } catch (e) {
    console.error('Error reading auth data:', e);
    return null;
  }
}

/**
 * Store auth data in localStorage
 */
export function storeAuth(data: BFCAuthData): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
    console.log('BFC Auth: Stored auth for user', data.user_id);
  } catch (e) {
    console.error('Error storing auth data:', e);
  }
}

/**
 * Clear auth data (logout)
 */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(AUTH_STORAGE_KEY);
  console.log('BFC Auth: Cleared auth data');
}

/**
 * Get user_id for API calls
 * Returns the authenticated user_id or null if not authenticated
 */
export function getUserId(): string | null {
  const auth = getStoredAuth();
  return auth?.user_id || null;
}

/**
 * Get user's display name
 */
export function getUserName(): string | null {
  const auth = getStoredAuth();
  return auth?.name || null;
}

/**
 * Validate an auth token with WordPress
 * Called when ?auth_token= is present in URL
 */
export async function validateAuthToken(token: string): Promise<BFCAuthData | null> {
  try {
    console.log('BFC Auth: Validating token...');
    
    const response = await fetch(`${WORDPRESS_URL}/wp-json/voice-coach/v1/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('BFC Auth: Token validation failed:', error);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.user_id) {
      console.log('BFC Auth: Token validated for user', data.user_id);
      return data as BFCAuthData;
    }
    
    return null;
  } catch (e) {
    console.error('BFC Auth: Error validating token:', e);
    return null;
  }
}

/**
 * Check if stored auth is still valid with WordPress
 */
export async function verifyStoredAuth(): Promise<boolean> {
  const auth = getStoredAuth();
  if (!auth) return false;
  
  try {
    const response = await fetch(
      `${WORDPRESS_URL}/wp-json/voice-coach/v1/auth/status?user_id=${encodeURIComponent(auth.user_id)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.log('BFC Auth: Stored auth is no longer valid');
      clearAuth();
      return false;
    }
    
    const data = await response.json();
    return data.authenticated === true;
  } catch (e) {
    console.error('BFC Auth: Error verifying auth:', e);
    return false;
  }
}

/**
 * Get WordPress login URL with redirect back to chat
 */
export function getLoginUrl(): string {
  // This URL should point to your ProfilePress login page
  // with a parameter that tells WordPress to redirect back to chat after login
  return `${WORDPRESS_URL}/login/?redirect_to_chat=1`;
}

/**
 * Redirect to WordPress login
 */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  window.location.href = getLoginUrl();
}


// =============================================================================
// FILE 2: hooks/useAuth.ts (CREATE THIS NEW FILE)
// =============================================================================

/**
 * hooks/useAuth.ts
 * 
 * React hook for authentication
 */

/*
import { useState, useEffect } from 'react';
import { 
  BFCAuthData, 
  getStoredAuth, 
  storeAuth, 
  clearAuth, 
  validateAuthToken,
  isAuthenticated,
  getUserId,
  getUserName,
  getLoginUrl 
} from '@/lib/auth';

export function useAuth() {
  const [auth, setAuth] = useState<BFCAuthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for auth token in URL on mount
  useEffect(() => {
    async function initAuth() {
      setLoading(true);
      setError(null);
      
      // Check URL for auth_token
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('auth_token');
        
        if (token) {
          console.log('BFC Auth: Found token in URL, validating...');
          
          const authData = await validateAuthToken(token);
          
          if (authData) {
            storeAuth(authData);
            setAuth(authData);
            
            // Clean URL by removing the token
            urlParams.delete('auth_token');
            const newUrl = urlParams.toString() 
              ? `${window.location.pathname}?${urlParams.toString()}`
              : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
            
            console.log('BFC Auth: Authenticated as', authData.name);
          } else {
            setError('Authentication failed. Please try logging in again.');
          }
          
          setLoading(false);
          return;
        }
      }
      
      // No token in URL, check localStorage
      const storedAuth = getStoredAuth();
      if (storedAuth) {
        setAuth(storedAuth);
        console.log('BFC Auth: Restored auth from storage for', storedAuth.name);
      }
      
      setLoading(false);
    }
    
    initAuth();
  }, []);

  const logout = () => {
    clearAuth();
    setAuth(null);
  };

  return {
    auth,
    loading,
    error,
    isAuthenticated: auth !== null,
    userId: auth?.user_id || null,
    userName: auth?.name || null,
    logout,
    loginUrl: getLoginUrl(),
  };
}
*/


// =============================================================================
// FILE 3: UPDATE wordpress-client.ts
// =============================================================================

/**
 * Update your existing wordpress-client.ts to include user_id in all requests
 * 
 * Here's how to modify it:
 */

/*
// At the top of wordpress-client.ts, add:
import { getUserId } from '@/lib/auth';

// Then update your API call functions to include user_id.
// For example, if you have a sendMessage function:

export async function sendTextMessage(message: string): Promise<any> {
  const userId = getUserId();
  
  const response = await fetch(`${WORDPRESS_URL}/wp-json/voice-chat/v1/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      user_id: userId,  // <-- ADD THIS
    }),
  });
  
  return response.json();
}

// Similarly for other endpoints:
export async function createBetterSelf(data: any): Promise<any> {
  const userId = getUserId();
  
  const response = await fetch(`${WORDPRESS_URL}/wp-json/voice-chat/v1/better-self/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...data,
      user_id: userId,  // <-- ADD THIS
    }),
  });
  
  return response.json();
}
*/


// =============================================================================
// FILE 4: UPDATE YOUR MAIN CHAT COMPONENT
// =============================================================================

/**
 * Update your main chat component (e.g., voice-chat.tsx) to use authentication
 * 
 * Here's a basic example of how to integrate:
 */

/*
// In your main chat component (e.g., app/page.tsx or components/voice-chat.tsx):

import { useAuth } from '@/hooks/useAuth';

export default function ChatPage() {
  const { auth, loading, error, isAuthenticated, userName, loginUrl, logout } = useAuth();
  
  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <span className="ml-3">Loading...</span>
      </div>
    );
  }
  
  // Show error if auth failed
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-500 mb-4">{error}</div>
        <a 
          href={loginUrl}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Try Logging In Again
        </a>
      </div>
    );
  }
  
  // Require authentication
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Welcome to Best Fit Coach</h1>
        <p className="text-gray-600 mb-6">Please log in to start your coaching session.</p>
        <a 
          href={loginUrl}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Log In to Continue
        </a>
      </div>
    );
  }
  
  // User is authenticated - show chat
  return (
    <div className="min-h-screen">
      {/* Header with user info *}
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <div>
          <span className="text-gray-600">Welcome back, </span>
          <span className="font-semibold">{userName}</span>
        </div>
        <button 
          onClick={logout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Log Out
        </button>
      </header>
      
      {/* Your existing chat component *}
      <main>
        {/* ... your chat UI ... *}
      </main>
    </div>
  );
}
*/


// =============================================================================
// FILE 5: COMPLETE INTEGRATION EXAMPLE
// =============================================================================

/**
 * Here's a complete, ready-to-use auth provider component
 * that you can wrap your app with:
 */

/*
// Create: components/AuthProvider.tsx

'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BFCAuthData } from '@/lib/auth';

interface AuthContextType {
  auth: BFCAuthData | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  userId: string | null;
  userName: string | null;
  logout: () => void;
  loginUrl: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authState = useAuth();
  
  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

// Then in your app/layout.tsx:
// 
// import { AuthProvider } from '@/components/AuthProvider';
// 
// export default function RootLayout({ children }) {
//   return (
//     <html>
//       <body>
//         <AuthProvider>
//           {children}
//         </AuthProvider>
//       </body>
//     </html>
//   );
// }
*/



