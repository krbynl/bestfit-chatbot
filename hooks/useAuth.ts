/**
 * Simplified Auth Hook - Guest Mode Only
 * Token auth removed
 * 
 * File: hooks/useAuth.tsx
 */

'use client';

import { useState, useEffect } from 'react';

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);

  // Clean up any leftover auth tokens from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('auth_token');
      
      // If there's a token in the URL, remove it
      if (token) {
        console.log('BFC Auth: Cleaning up old auth token from URL');
        
        // Remove token from URL without page reload
        const url = new URL(window.location.href);
        url.searchParams.delete('auth_token');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  return {
    isAuthenticated: false, // Always false in guest mode
    isLoading,
    error: null,
    userId: null,
    userName: null,
    loginUrl: 'https://bestfitcoach.com/login',
  };
}
