import { useState, useEffect } from 'react';
import { 
  BFCAuthData, 
  getStoredAuth, 
  storeAuth, 
  clearAuth, 
  validateAuthToken,
  getLoginUrl 
} from '@/lib/auth';

export function useAuth() {
  const [auth, setAuth] = useState<BFCAuthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initAuth() {
      setLoading(true);
      setError(null);
      
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('auth_token');
        
        if (token) {
          const authData = await validateAuthToken(token);
          
          if (authData) {
            storeAuth(authData);
            setAuth(authData);
            
            // Clean URL
            urlParams.delete('auth_token');
            const newUrl = urlParams.toString() 
              ? `${window.location.pathname}?${urlParams.toString()}`
              : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          } else {
            setError('Authentication failed. Please try logging in again.');
          }
          
          setLoading(false);
          return;
        }
      }
      
      const storedAuth = getStoredAuth();
      if (storedAuth) {
        setAuth(storedAuth);
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
