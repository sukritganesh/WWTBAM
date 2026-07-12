import { useEffect, useState } from 'react';
import { speechManager } from './SpeechManager';

export function useSpeechVoices(): readonly SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<readonly SpeechSynthesisVoice[]>(() => speechManager.getVoices());
  useEffect(() => speechManager.subscribe(() => setVoices([...speechManager.getVoices()])), []);
  return voices;
}
