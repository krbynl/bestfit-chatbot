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

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  const authData = getStoredAuth();
  return authData !== null && authData.user_id !== undefined;
}

export function getStoredAuth(): BFCAuthData | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as BFCAuthData;
  } catch (e) {
    console.error('Error reading auth data:', e);
    return null;
  }
}

export function storeAuth(data: BFCAuthData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
    console.log('BFC Auth: Stored auth for user', data.user_id);
  } catch (e) {
    console.error('Error storing auth data:', e);
  }
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getUserId(): string | null {
  const auth = getStoredAuth();
  return auth?.user_id || null;
}

export function getUserName(): string | null {
  const auth = getStoredAuth();
  return auth?.name || null;
}

export async function validateAuthToken(token: string): Promise<BFCAuthData | null> {
  try {
    const response = await fetch(`${WORDPRESS_URL}/wp-json/voice-coach/v1/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.success && data.user_id) {
      return data as BFCAuthData;
    }
    return null;
  } catch (e) {
    console.error('BFC Auth: Error validating token:', e);
    return null;
  }
}

export function getLoginUrl(): string {
  return `${WORDPRESS_URL}/login/?redirect_to_chat=1`;
}

export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  window.location.href = getLoginUrl();
}
