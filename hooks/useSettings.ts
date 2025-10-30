import { useState, useEffect } from 'react';
import { AIVoice, AIPersonality, InterviewerSettings } from '../types';

const defaultSettings: InterviewerSettings = {
  voice: 'Kore',
  personality: 'Professional',
};

const useSettings = () => {
  const [settings, setSettings] = useState<InterviewerSettings>(defaultSettings);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('sentio-user-settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error("Could not load settings from localStorage", error);
    }
  }, []);

  const updateSettings = (newSettings: Partial<InterviewerSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('sentio-user-settings', JSON.stringify(updated));
      } catch (error) {
        console.error("Could not save settings to localStorage", error);
      }
      return updated;
    });
  };

  return { settings, updateSettings };
};

export default useSettings;
