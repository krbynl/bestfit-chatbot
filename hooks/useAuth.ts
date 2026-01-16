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

  return {
    isAuthenticated: false, // Always false in guest mode
    isLoading,
    error: null,
    userId: null,
    userName: null,
    loginUrl: 'https://bestfitcoach.com/login',
  };
}
