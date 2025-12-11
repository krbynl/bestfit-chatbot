/**
 * Voice Recording Hook
 * Handles microphone access and audio recording
 */

import { useState, useRef, useCallback } from 'react';

export interface VoiceRecorderState {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  audioBlob: Blob | null;
}

export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isProcessing: false,
    error: null,
    audioBlob: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null, audioBlob: null }));

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setState(prev => ({ ...prev, isRecording: true }));

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to access microphone';
      setState(prev => ({ ...prev, error: message }));
      throw error;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        setState(prev => ({ ...prev, isRecording: false }));
        resolve(null);
        return;
      }

      setState(prev => ({ ...prev, isProcessing: true }));

      mediaRecorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        chunksRef.current = [];
        
        setState(prev => ({
          ...prev,
          isRecording: false,
          isProcessing: false,
          audioBlob: blob,
        }));
        
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];
    mediaRecorderRef.current = null;

    setState({
      isRecording: false,
      isProcessing: false,
      error: null,
      audioBlob: null,
    });
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError,
  };
}

export default useVoiceRecorder;
