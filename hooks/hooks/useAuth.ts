/**
 * BFC Auth Hook
 * 
 * File: hooks/useAuth.ts
 * 
 * React hook for managing authentication state
 * Handles token validation from URL and persistent auth
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { wordpressClient } from '@/lib/wordpress-client';

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  userId: string | null;
  userName: string | null;
}

export interface UseAuthReturn extends AuthState {
  logout: () => void;
  loginUrl: string;
  checkAuth: () => void;
}

/**
 * Hook for managing BFC authentication
 * 
 * Usage:
 * ```tsx
 * const { isAuthenticated, isLoading, userName, logout, loginUrl } = useAuth();
 * 
 * if (isLoading) return <Loading />;
 * if (!isAuthenticated) return <a href={loginUrl}>Login</a>;
 * return <div>Welcome, {userName}!</div>;
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
    userId: null,
    userName: null,
  });

  /**
   * Check for auth token in URL and validate
   */
  const initializeAuth = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check if we're in browser
      if (typeof window === 'undefined') {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Check URL for auth_token
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('auth_token');

      if (token) {
        console.log('BFC Auth: Found token in URL, validating...');
        
        const authData = await wordpressClient.validateToken(token);
        
        if (authData) {
          // Clean URL by removing the token
          urlParams.delete('auth_token');
          const newUrl = urlParams.toString() 
            ? `${window.location.pathname}?${urlParams.toString()}`
            : window.location.pathname;
          window.history.replaceState({}, '', newUrl);
          
          setState({
            isAuthenticated: true,
            isLoading: false,
            error: null,
            userId: authData.user_id,
            userName: authData.name,
          });
          
          console.log('BFC Auth: Authenticated as', authData.name);
          return;
        } else {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Authentication failed. Please try logging in again.',
          }));
          return;
        }
      }

      // No token in URL - check if already authenticated
      if (wordpressClient.isUserAuthenticated()) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          error: null,
          userId: wordpressClient.getUserId(),
          userName: wordpressClient.getUserName(),
        });
        console.log('BFC Auth: Restored from storage');
      } else {
        // Not authenticated
        setState({
          isAuthenticated: false,
          isLoading: false,
          error: null,
          userId: null,
          userName: null,
        });
      }
    } catch (error) {
      console.error('BFC Auth: Error during initialization', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'An error occurred during authentication.',
      }));
    }
  }, []);

  /**
   * Logout and clear auth data
   */
  const logout = useCallback(() => {
    wordpressClient.logout();
    setState({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      userId: null,
      userName: null,
    });
    console.log('BFC Auth: Logged out');
  }, []);

  /**
   * Re-check authentication status
   */
  const checkAuth = useCallback(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return {
    ...state,
    logout,
    loginUrl: wordpressClient.getLoginUrl(),
    checkAuth,
  };
}

export default useAuth;
