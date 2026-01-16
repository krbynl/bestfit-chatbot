'use client';

import { useState, useEffect } from 'react';

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('auth_token');
      
      if (token) {
        console.log('BFC Auth: Cleaning up old auth token from URL');
        const url = new URL(window.location.href);
        url.searchParams.delete('auth_token');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  return {
    isAuthenticated: false,
    isLoading,
    error: null,
    userId: null,
    userName: null,
    loginUrl: 'https://bestfitcoach.com/login',
  };
}
