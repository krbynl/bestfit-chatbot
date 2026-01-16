/**
 * WordPress Voice Chat API Client
 * Connects Vercel AI Chatbot to WordPress backend
 * 
 * File: lib/wordpress-client.ts
 * 
 * CLEANED VERSION - Token auth removed, guest ID persistence fixed
 */

// =============================================================================
// INTERFACES
// =============================================================================

export interface VoiceSession {
  user_id: string;
  system_prompt: string;
  has_memories: boolean;
  created_at: string;
}

export interface VoiceMessageResponse {
  success: boolean;
  user_message?: string;
  ai_response?: string;
  audio?: string;
  audio_format?: string;
  error?: string;
  workouts_logged?: number;
  better_self_created?: {
    challenge_id: number;
    better_self_name: string;
  } | null;
}

export interface TextMessageResponse {
  success: boolean;
  user_id?: string;
  ai_response?: string;
  has_memory?: boolean;
  error?: string;
  workouts_logged?: number;
  better_self_created?: {
    challenge_id: number;
    better_self_name: string;
  } | null;
}

export interface MemoriesResponse {
  success: boolean;
  user_id?: string;
  memories?: string;
  error?: string;
}

export interface BetterSelfData {
  id: number;
  user_id: string;
  better_self_name: string;
  why_statement: string;
  primary_focus: string;
  program_weeks: number;
  start_date: string;
  target_date: string;
  status: string;
  start_weight: number | null;
  goal_weight: number | null;
  current_weight: number | null;
  goal_workouts_per_week: number;
  total_workouts: number;
  current_streak: number;
}

export interface BetterSelfGap {
  week: number;
  total_weeks: number;
  progress_percent: number;
  days_remaining: number;
  better_self_name: string;
  why_statement: string;
  overall_status: 'ahead' | 'on_track' | 'slightly_behind' | 'behind';
  metrics: Record<string, {
    current: number;
    projected: number;
    goal: number;
    diff: number;
    unit: string;
    status: string;
  }>;
}

export interface BetterSelfResponse {
  success: boolean;
  has_challenge: boolean;
  better_self?: BetterSelfData;
  projection?: any;
  gap?: BetterSelfGap;
  motivation_message?: string;
  message?: string;
  error?: string;
}

// =============================================================================
// WORDPRESS CLIENT CLASS
// =============================================================================

class WordPressVoiceClient {
  private baseUrl: string;
  private userId: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Get user ID - with persistence
   * CRITICAL FIX: Always returns same ID once set
   */
  getUserId(): string | null {
    // Priority 1: Check memory
    if (this.userId) {
      return this.userId;
    }
    
    // Priority 2: Check localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vc_user_id');
      if (stored) {
        this.userId = stored;
        return stored;
      }
    }
    
    return null;
  }

  /**
   * Set user ID - with persistence
   */
  private setUserId(id: string): void {
    this.userId = id;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vc_user_id', id);
      console.log('BFC: Stored user_id:', id);
    }
  }

  /**
   * Create a voice chat session with memory context
   * CRITICAL FIX: Only creates NEW user_id if none exists
   */
  async createSession(query: string = 'Hello'): Promise<VoiceSession> {
    // CRITICAL: Get existing user_id FIRST
    let userId = this.getUserId();
    
    console.log('BFC: Creating session with user_id:', userId || 'new user');
    
    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        user_id: userId, // Send existing ID or null
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const data = await response.json();
    
    // CRITICAL FIX: Only store NEW user_id if we didn't have one before
    if (!userId && data.session?.user_id) {
      console.log('BFC: New user created:', data.session.user_id);
      this.setUserId(data.session.user_id);
    } else if (userId) {
      console.log('BFC: Using existing user_id:', userId);
    }

    return data.session;
  }

  /**
   * Send voice message (audio file) - Full pipeline
   */
  async sendVoiceMessage(
    audioBlob: Blob,
    voice: string = 'onyx'
  ): Promise<VoiceMessageResponse> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('voice', voice);
    
    const userId = this.getUserId();
    if (userId) formData.append('user_id', userId);

    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/message`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Voice message failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Send text message with memory
   */
  async sendTextMessage(message: string): Promise<TextMessageResponse> {
    const userId = this.getUserId();

    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        user_id: userId,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Text message failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Transcribe audio only (Whisper)
   */
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/transcribe`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text;
  }

  /**
   * Generate speech from text (TTS)
   */
  async generateSpeech(text: string, voice: string = 'onyx'): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/speak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voice }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Speech generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.audio) {
      throw new Error(data.error || 'No audio returned');
    }

    // Convert base64 to Blob
    const binaryString = atob(data.audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: 'audio/mpeg' });
  }

  /**
   * Get user memories
   */
  async getMemories(query: string = 'recent', limit: number = 10): Promise<string> {
    const userId = this.getUserId();
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
    });
    
    if (userId) params.append('user_id', userId);

    const response = await fetch(
      `${this.baseUrl}/wp-json/voice-chat/v1/memories?${params}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get memories: ${response.statusText}`);
    }

    const data = await response.json();
    return data.memories || '';
  }

  // ===========================================================================
  // BETTER SELF CHALLENGER METHODS
  // ===========================================================================

  /**
   * Get current Better Self challenge
   */
  async getBetterSelf(): Promise<BetterSelfResponse> {
    const userId = this.getUserId();
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);

    const response = await fetch(
      `${this.baseUrl}/wp-json/voice-chat/v1/better-self?${params}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get Better Self: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new Better Self challenge
   */
  async createBetterSelf(data: Partial<BetterSelfData>): Promise<BetterSelfResponse> {
    const userId = this.getUserId();

    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/better-self/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        user_id: userId,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to create Better Self: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get gap analysis between current self and Better Self
   */
  async getBetterSelfGap(): Promise<{ success: boolean; gap?: BetterSelfGap; motivation_message?: string; error?: string }> {
    const userId = this.getUserId();
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);

    const response = await fetch(
      `${this.baseUrl}/wp-json/voice-chat/v1/better-self/gap?${params}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get gap: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update Better Self metrics
   */
  async updateBetterSelfMetrics(metrics: {
    weight?: number;
    pushups?: number;
    squats?: number;
    run_distance?: number;
  }): Promise<BetterSelfResponse> {
    const userId = this.getUserId();

    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/better-self/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...metrics,
        user_id: userId,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to update metrics: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Pause Better Self challenge
   */
  async pauseBetterSelf(): Promise<{ success: boolean; message?: string; error?: string }> {
    const userId = this.getUserId();

    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/better-self/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
      credentials: 'include',
    });

    return response.json();
  }

  /**
   * Resume Better Self challenge
   */
  async resumeBetterSelf(): Promise<BetterSelfResponse> {
    const userId = this.getUserId();

    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/better-self/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
      credentials: 'include',
    });

    return response.json();
  }

  /**
   * Recalibrate Better Self (fresh start)
   */
  async recalibrateBetterSelf(): Promise<BetterSelfResponse> {
    const userId = this.getUserId();

    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/better-self/recalibrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
      credentials: 'include',
    });

    return response.json();
  }

  /**
   * Get user milestones
   */
  async getMilestones(): Promise<{ success: boolean; milestones: any[]; total: number }> {
    const userId = this.getUserId();
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);

    const response = await fetch(
      `${this.baseUrl}/wp-json/voice-chat/v1/milestones?${params}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    return response.json();
  }

  /**
   * Check for new celebrations
   */
  async checkCelebrations(): Promise<{ success: boolean; has_celebrations: boolean; celebrations: string[]; count: number }> {
    const userId = this.getUserId();
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);

    const response = await fetch(
      `${this.baseUrl}/wp-json/voice-chat/v1/celebrations?${params}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    return response.json();
  }

  /**
   * Get weekly progress report
   */
  async getWeeklyReport(): Promise<{ success: boolean; report?: string; error?: string }> {
    const userId = this.getUserId();
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);

    const response = await fetch(
      `${this.baseUrl}/wp-json/voice-chat/v1/better-self/weekly-report?${params}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    return response.json();
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Play audio from base64 string
   */
  playAudio(base64Audio: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        
        audio.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        
        audio.play();
      } catch (error) {
        reject(error);
      }
    });
  }
}

// =============================================================================
// EXPORT
// =============================================================================

const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://bestfitcoach.com';
export const wordpressClient = new WordPressVoiceClient(wordpressUrl);

export default WordPressVoiceClient;
