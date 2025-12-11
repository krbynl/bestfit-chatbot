'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { wordpressClient } from '@/lib/wordpress-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function VoiceChat({ className = '' }: { className?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { state: recorderState, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

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
        setSessionReady(true); // Still allow usage
      }
    };
    initSession();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const playAudio = useCallback(async (base64Audio: string) => {
    if (!autoSpeak) return;
    setIsSpeaking(true);
    try {
      await wordpressClient.playAudio(base64Audio);
    } catch (err) {
      console.error('Audio playback failed:', err);
    } finally {
      setIsSpeaking(false);
    }
  }, [autoSpeak]);

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

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.ai_response || '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (voiceEnabled && autoSpeak && response.ai_response) {
        try {
          const audioBlob = await wordpressClient.generateSpeech(response.ai_response, 'nova');
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            playAudio(base64);
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
  }, [isLoading, voiceEnabled, autoSpeak, playAudio]);

  const sendVoiceMessage = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const audioBlob = await stopRecording();
      if (!audioBlob) throw new Error('No audio recorded');

      const tempId = `user-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: tempId,
        role: 'user',
        content: '🎤 Processing voice...',
        timestamp: new Date(),
      }]);

      const response = await wordpressClient.sendVoiceMessage(audioBlob, 'nova');
      if (!response.success) throw new Error(response.error || 'Failed to process voice');

      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, content: response.user_message || '(Voice message)' }
            : msg
        )
      );

      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.ai_response || '',
        timestamp: new Date(),
      }]);

      if (response.audio && autoSpeak) {
        await playAudio(response.audio);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Voice processing failed';
      setError(message);
      setMessages(prev => prev.filter(msg => !msg.content.includes('Processing')));
    } finally {
      setIsLoading(false);
    }
  }, [stopRecording, autoSpeak, playAudio]);

  const handleVoiceClick = useCallback(async () => {
    if (recorderState.isRecording) {
      await sendVoiceMessage();
    } else {
      try {
        await startRecording();
      } catch (err) {
        setError('Microphone access denied. Please enable microphone permissions.');
      }
    }
  }, [recorderState.isRecording, startRecording, sendVoiceMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendTextMessage(inputText);
  };

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">AI Coach</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-full transition-colors ${voiceEnabled ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`px-3 py-1 text-xs rounded-full ${autoSpeak ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}
          >
            {autoSpeak ? 'Auto-speak ON' : 'Auto-speak OFF'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2 bg-red-50 text-red-800 text-sm text-center">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg mb-2">👋 Hi there!</p>
            <p>Type a message or click the microphone to start talking.</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-2">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {voiceEnabled && (
            <button
              type="button"
              onClick={handleVoiceClick}
              disabled={isLoading}
              className={`p-3 rounded-full transition-all ${recorderState.isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {recorderState.isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={recorderState.isRecording ? 'Recording... Click mic to stop' : 'Type a message...'}
            disabled={recorderState.isRecording || isLoading}
            className="flex-1 px-4 py-2 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading || recorderState.isRecording}
            className="p-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </form>

        {recorderState.isRecording && (
          <div className="mt-2 text-center text-sm text-red-600 flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Recording... Click microphone to stop
            <button onClick={cancelRecording} className="ml-2 text-gray-500 underline">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceChat;
