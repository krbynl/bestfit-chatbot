'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Phone, PhoneOff } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { wordpressClient } from '@/lib/wordpress-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Animated Wave Component for Speaking/Processing
const AnimatedWave = ({ isActive, color = '#10b981' }: { isActive: boolean; color?: string }) => (
  <div className="flex items-center gap-1">
    {[...Array(4)].map((_, i) => (
      <div
        key={i}
        className={`w-1 rounded-full transition-all duration-150 ${isActive ? 'animate-wave' : 'h-2'}`}
        style={{
          backgroundColor: color,
          height: isActive ? '16px' : '8px',
          animationDelay: `${i * 0.15}s`,
        }}
      />
    ))}
    <style jsx>{`
      @keyframes wave {
        0%, 100% { height: 8px; }
        50% { height: 20px; }
      }
      .animate-wave {
        animation: wave 0.8s ease-in-out infinite;
      }
    `}</style>
  </div>
);

// Loading Animation Component
const LoadingAnimation = () => (
  <div className="flex flex-col items-center justify-center py-6">
    <div className="relative w-20 h-20">
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border-4 border-amber-200/30 animate-ping" />
      {/* Middle ring */}
      <div className="absolute inset-2 rounded-full border-4 border-amber-300/50 animate-pulse" />
      {/* Inner circle */}
      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 animate-pulse flex items-center justify-center">
        <div className="flex items-center gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 bg-white rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
    <p className="mt-4 text-amber-200 text-sm font-medium animate-pulse">Coach is thinking...</p>
  </div>
);

// Speaking Wave Animation for AI Bubble
const SpeakingWave = () => (
  <div className="flex items-center gap-0.5 ml-2">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className="w-1 bg-emerald-400 rounded-full animate-speaking"
        style={{
          animationDelay: `${i * 0.1}s`,
        }}
      />
    ))}
    <style jsx>{`
      @keyframes speaking {
        0%, 100% { height: 4px; }
        50% { height: 16px; }
      }
      .animate-speaking {
        animation: speaking 0.5s ease-in-out infinite;
      }
    `}</style>
  </div>
);

export function VoiceChat({ className = '' }: { className?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  
  // Continuous voice mode
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const voiceModeRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { state: recorderState, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await wordpressClient.createSession();
        setSessionReady(true);
        if (session.has_memories) {
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: "Welcome back! I remember our previous conversations. How can I help you today?",
            timestamp: new Date(),
          }]);
        }
      } catch (err) {
        console.error('Failed to initialize session:', err);
        setSessionReady(true);
      }
    };
    initSession();
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep voiceModeRef in sync
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  const playAudio = useCallback(async (base64Audio: string, messageId?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      setIsSpeaking(true);
      if (messageId) setCurrentSpeakingId(messageId);
      
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
          setIsSpeaking(false);
          setCurrentSpeakingId(null);
          resolve();
        };
        
        audio.onerror = (e) => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
          setCurrentSpeakingId(null);
          reject(e);
        };
        
        audio.play();
      } catch (error) {
        setIsSpeaking(false);
        setCurrentSpeakingId(null);
        reject(error);
      }
    });
  }, []);

  // Start listening in voice mode
  const startListening = useCallback(async () => {
    if (!voiceModeRef.current) return;
    
    setIsListening(true);
    try {
      await startRecording();
    } catch (err) {
      setError('Microphone access denied');
      setVoiceMode(false);
      setIsListening(false);
    }
  }, [startRecording]);

  // Process voice and continue conversation
  const processVoiceAndContinue = useCallback(async () => {
    if (!recorderState.isRecording) return;
    
    setIsListening(false);
    setIsLoading(true);
    setError(null);

    try {
      const audioBlob = await stopRecording();
      if (!audioBlob) throw new Error('No audio recorded');

      const tempId = `user-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: tempId,
        role: 'user',
        content: '🎤 Processing...',
        timestamp: new Date(),
      }]);

      const response = await wordpressClient.sendVoiceMessage(audioBlob, 'nova');
      if (!response.success) throw new Error(response.error || 'Failed to process voice');

      // Update user message with transcription
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, content: response.user_message || '(Voice message)' }
            : msg
        )
      );

      // Add assistant response
      const assistantId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: response.ai_response || '',
        timestamp: new Date(),
      }]);

      setIsLoading(false);

      // Play audio and then continue listening if still in voice mode
      if (response.audio && autoSpeak) {
        await playAudio(response.audio, assistantId);
      }
      
      // Continue listening if voice mode is still active
      if (voiceModeRef.current) {
        setTimeout(() => startListening(), 500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Voice processing failed';
      setError(message);
      setMessages(prev => prev.filter(msg => !msg.content.includes('Processing')));
      setIsLoading(false);
      
      // Try to continue if still in voice mode
      if (voiceModeRef.current) {
        setTimeout(() => startListening(), 1000);
      }
    }
  }, [recorderState.isRecording, stopRecording, autoSpeak, playAudio, startListening]);

  // Toggle voice mode
  const toggleVoiceMode = useCallback(async () => {
    if (voiceMode) {
      // Stop voice mode
      setVoiceMode(false);
      voiceModeRef.current = false;
      setIsListening(false);
      if (recorderState.isRecording) {
        cancelRecording();
      }
    } else {
      // Start voice mode
      setVoiceMode(true);
      voiceModeRef.current = true;
      await startListening();
    }
  }, [voiceMode, recorderState.isRecording, cancelRecording, startListening]);

  // Handle tap to send in voice mode (when recording)
  const handleVoiceTap = useCallback(async () => {
    if (recorderState.isRecording) {
      await processVoiceAndContinue();
    }
  }, [recorderState.isRecording, processVoiceAndContinue]);

  // Send text message
  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await wordpressClient.sendTextMessage(text);
      if (!response.success) throw new Error(response.error || 'Failed to get response');

      const assistantId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: response.ai_response || '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (autoSpeak && response.ai_response) {
        try {
          const audioBlob = await wordpressClient.generateSpeech(response.ai_response, 'nova');
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            playAudio(base64, assistantId);
          };
          reader.readAsDataURL(audioBlob);
        } catch (speechErr) {
          console.error('Speech generation failed:', speechErr);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, autoSpeak, playAudio]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendTextMessage(inputText);
  };

  return (
    <div className={`flex flex-col h-full ${className}`} style={{
      background: 'linear-gradient(135deg, #1a1512 0%, #2d2319 25%, #3d2e1f 50%, #2d2319 75%, #1a1512 100%)',
    }}>
      {/* Warm overlay pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4a574' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />
      
      {/* Header */}
      <div className="relative flex items-center justify-between p-4 border-b border-amber-900/30 bg-gradient-to-r from-amber-950/80 to-orange-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl">
            🏋️
          </div>
          <div>
            <h2 className="text-lg font-semibold text-amber-100">Coach BFC</h2>
            <p className="text-xs text-amber-300/70">Your Personal Fitness Guide</p>
          </div>
        </div>
        <button
          onClick={() => setAutoSpeak(!autoSpeak)}
          className={`flex items-center gap-2 px-3 py-2 text-xs rounded-full transition-all ${
            autoSpeak 
              ? 'bg-emerald-600/80 text-white shadow-lg shadow-emerald-500/20' 
              : 'bg-amber-900/50 text-amber-300'
          }`}
        >
          {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
          {autoSpeak ? 'Sound ON' : 'Sound OFF'}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="relative p-3 bg-red-900/50 text-red-200 text-sm text-center backdrop-blur-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline hover:text-red-100">Dismiss</button>
        </div>
      )}

      {/* Voice Mode Banner */}
      {voiceMode && (
        <div className={`relative p-4 text-center text-white backdrop-blur-sm flex items-center justify-center gap-3 ${
          isListening ? 'bg-red-600/80' : 
          isSpeaking ? 'bg-blue-600/80' : 
          isLoading ? 'bg-amber-600/80' : 'bg-emerald-600/80'
        }`}>
          <AnimatedWave isActive={isListening || isSpeaking} color="white" />
          <span className="font-medium">
            {isListening && '🎤 Listening... Tap when done speaking'}
            {isSpeaking && '🔊 Coach is speaking...'}
            {isLoading && '⏳ Processing your message...'}
            {!isListening && !isSpeaking && !isLoading && '✅ Ready - Tap to speak'}
          </span>
          <AnimatedWave isActive={isListening || isSpeaking} color="white" />
        </div>
      )}

      {/* Messages */}
      <div className="relative flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center">
              <span className="text-5xl">👋</span>
            </div>
            <p className="text-xl mb-2 text-amber-100 font-medium">Welcome!</p>
            <p className="text-amber-300/70">Type a message or start a voice conversation</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-lg ${
              message.role === 'user' 
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
                : 'bg-gradient-to-br from-amber-100 to-orange-100 text-amber-950'
            }`}>
              <div className="flex items-start gap-2">
                <p className="whitespace-pre-wrap leading-relaxed flex-1">{message.content}</p>
                {message.role === 'assistant' && currentSpeakingId === message.id && (
                  <SpeakingWave />
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Loading Animation */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-6 py-4 bg-gradient-to-br from-amber-100 to-orange-100 shadow-lg">
              <LoadingAnimation />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative border-t border-amber-900/30 p-4 bg-gradient-to-r from-amber-950/90 to-orange-950/90 backdrop-blur-sm">
        {/* Voice Mode Toggle Button */}
        <div className="flex justify-center mb-4">
          <button
            onClick={voiceMode ? (recorderState.isRecording ? handleVoiceTap : toggleVoiceMode) : toggleVoiceMode}
            disabled={isLoading && !voiceMode}
            className={`flex items-center gap-3 px-8 py-4 rounded-full text-lg font-semibold transition-all transform active:scale-95 shadow-xl ${
              voiceMode
                ? recorderState.isRecording
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/30 animate-pulse'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/30'
                : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-emerald-500/30 hover:shadow-emerald-500/50'
            }`}
          >
            {voiceMode ? (
              recorderState.isRecording ? (
                <>
                  <MicOff size={24} />
                  Tap to Send
                </>
              ) : (
                <>
                  <PhoneOff size={24} />
                  End Conversation
                </>
              )
            ) : (
              <>
                <Phone size={24} />
                Start Voice Chat
              </>
            )}
          </button>
        </div>

        {/* Text Input */}
        {!voiceMode && (
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
              className="flex-1 px-5 py-3 rounded-full bg-amber-950/50 text-amber-100 placeholder-amber-400/50 border border-amber-700/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
            >
              <Send size={20} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default VoiceChat;
