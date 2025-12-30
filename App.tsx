import React, { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Eye, EyeOff, Image as ImageIcon, Loader2 } from 'lucide-react';
import RainShader from './components/RainShader';
import Controls from './components/Controls';
import Editor from './components/Editor';
import { AppSettings } from './types';
import { initAudio, setGlobalVolume, resumeAudioContext, triggerThunder } from './services/audioService';
import { generateStudyBackground } from './services/geminiService';

interface NoteData {
  id: string;
  x: number;
  y: number;
  text?: string;
  zIndex: number;
}

// Default is now null (Procedural Mode)
const DEFAULT_BG = null;

// Simple Typewriter Component for static text
const TypewriterText: React.FC<{ text: string; delay?: number; speed?: number; className?: string }> = ({ 
  text, 
  delay = 0, 
  speed = 40,
  className = "" 
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [startTyping, setStartTyping] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStartTyping(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!startTyping) return;
    
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(prev => text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [startTyping, text, speed]);

  return <p className={className}>{displayedText}</p>;
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    // Media
    backgroundUrl: DEFAULT_BG,
    autoFitBackground: true,
    
    // Atmosphere (Updated defaults based on user request)
    rainIntensity: 0.26, 
    glassBlur: 0.07, 
    rainSpeed: 0.3,
    rainDropletSize: 1.5,
    stormIntensity: 0.0, // Default to OFF
    
    // Optics
    refraction: 1.0,
    zoom: 1.0,
    
    // Image
    brightness: 1.1, 
    contrast: 1.0,
    
    // Interface
    editorOpacity: 30, // Increased for visibility
    editorBlur: 5,
    editorRadius: 32,
    editorNoise: 15,
    editorShadow: 50,
    editorSaturation: 100,
    
    // Audio
    audioVolume: 1.0,
    isAudioPlaying: true, 
  });

  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(true);
  
  // Scene Auto-Generation State
  const [isAutoScene, setIsAutoScene] = useState(false);
  const [isSceneLoading, setIsSceneLoading] = useState(false);
  
  // Lightning State for Visuals
  const [lightningVal, setLightningVal] = useState(0);
  const lightningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lightningLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Manage multiple notes
  // Lazy init ensures window dimensions are captured accurately on mount for centering
  const [notes, setNotes] = useState<NoteData[]>(() => {
    // Check if main note exists in storage to avoid overwriting user data
    const hasSavedMain = localStorage.getItem('rainy-thoughts-content');
    
    // Responsive logic for initial placement
    const isMobile = window.innerWidth < 768;
    // Use 90% width on mobile to match Editor component logic
    const cardWidth = isMobile ? Math.min(450, window.innerWidth * 0.9) : 450;
    const cardHeight = isMobile ? Math.min(500, window.innerHeight * 0.6) : 500;
    
    return [{ 
      id: 'main', 
      // Centering logic
      x: (window.innerWidth - cardWidth) / 2, 
      y: (window.innerHeight - cardHeight) / 2, 
      zIndex: 1,
      // Only show welcome text if no saved content exists
      text: hasSavedMain === null ? "Welcome to your quiet space.\n\nThe rain falls outside, but here you are safe.\nTake a deep breath.\n\nWhat is on your mind today?" : undefined
    }];
  });
  const [topZ, setTopZ] = useState(1);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Audio Lifecycle
  useEffect(() => {
    if (settings.isAudioPlaying) {
      initAudio();
      setGlobalVolume(settings.audioVolume);
    } else {
      setGlobalVolume(0);
    }
  }, [settings.isAudioPlaying, settings.audioVolume]);

  useEffect(() => {
    const handleInteraction = () => {
      resumeAudioContext();
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
    
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Lightning Logic
  useEffect(() => {
    const scheduleLightning = () => {
      if (settings.stormIntensity <= 0.01) return;

      // Base Frequency:
      // High intensity = Frequent (e.g., every 5-15s)
      // Low intensity = Rare (e.g., every 20-60s)
      const minDelay = 5000;
      const variableDelay = (1.0 - settings.stormIntensity) * 40000; 
      const nextDelay = minDelay + Math.random() * variableDelay;

      lightningLoopRef.current = setTimeout(() => {
          triggerLightningEvent();
          scheduleLightning(); // Reschedule
      }, nextDelay);
    };

    const triggerLightningEvent = () => {
        // Stochastic check: Even if scheduled, 20% chance to skip for irregularity
        if (Math.random() > 0.8) return; 

        // 1. Calculate Distance (0=Close, 1=Far)
        // High intensity biases towards closer strikes
        const bias = settings.stormIntensity;
        const raw = Math.random();
        // If intensity is high, we want smaller distance values more often
        const distance = Math.max(0, Math.min(1, raw - (bias * 0.3))); 

        // 2. Trigger Visual Flash
        // Closer = Brighter
        const brightness = (1.0 - distance) * 0.8 + 0.2;
        
        // Double flash capability
        const isDouble = Math.random() > 0.7;

        const doFlash = () => {
            setLightningVal(brightness);
            setTimeout(() => setLightningVal(0), 100 + Math.random() * 200);
        };

        doFlash();
        if (isDouble) {
            setTimeout(doFlash, 150 + Math.random() * 150);
        }

        // 3. Trigger Audio (Delayed)
        if (settings.isAudioPlaying) {
            triggerThunder(distance);
        }
    };

    // Stop existing loop when intensity changes
    if (lightningLoopRef.current) clearTimeout(lightningLoopRef.current);

    // Start new loop if active
    if (settings.stormIntensity > 0) {
        scheduleLightning();
    }

    return () => {
        if (lightningLoopRef.current) clearTimeout(lightningLoopRef.current);
    };
  }, [settings.stormIntensity, settings.isAudioPlaying]);

  const handlePrompt = (prompt: string) => {
    setAiPrompt(prompt);
    // If the UI is hidden, show it when a prompt is requested
    if (!showEditor) setShowEditor(true);
  };

  // Scene Generation Logic
  const generateNewScene = useCallback(async () => {
      if (isSceneLoading) return;
      setIsSceneLoading(true);
      const bgUrl = await generateStudyBackground();
      if (bgUrl) {
          updateSettings({ backgroundUrl: bgUrl });
      }
      setIsSceneLoading(false);
  }, [isSceneLoading]); 

  // Auto-Scene Interval (2 Minutes)
  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (isAutoScene) {
          // Generate immediately on enable
          generateNewScene();
          
          interval = setInterval(() => {
              generateNewScene();
          }, 120000); // 120 seconds (2 minutes)
      }
      return () => clearInterval(interval);
  }, [isAutoScene]); 

  // Note Management
  const addNote = (x: number, y: number) => {
    // Check bounds to keep inside screen roughly
    const isMobile = window.innerWidth < 768;
    const cardWidth = isMobile ? Math.min(450, window.innerWidth * 0.9) : 450;
    
    const spawnX = Math.min(x, window.innerWidth - (cardWidth + 20));
    const spawnY = Math.min(y, window.innerHeight - 200);
    
    const newNote: NoteData = {
      id: Date.now().toString(),
      x: Math.max(20, spawnX), // Prevent spawning off-screen left
      y: Math.max(50, spawnY),
      zIndex: topZ + 1
    };
    setTopZ(prev => prev + 1);
    setNotes(prev => [...prev, newNote]);
  };

  const deleteNote = (id: string) => {
    // Immediate deletion without confirmation for "instant" feel
    // Clean up storage
    if (id === 'main') {
        localStorage.removeItem('rainy-thoughts-content');
    } else {
        localStorage.removeItem(`rainy-thoughts-content-${id}`);
    }
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const bringToFront = (id: string) => {
    setTopZ(prev => prev + 1);
    setNotes(prev => prev.map(n => n.id === id ? { ...n, zIndex: topZ + 1 } : n));
  };

  return (
    <main className="relative w-full h-screen bg-black overflow-hidden font-sans">
      {/* 3D Background Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas 
            orthographic 
            camera={{ zoom: 1, position: [0, 0, 100] }}
            dpr={[1, 2]} 
        >
          <Suspense fallback={null}>
            <RainShader settings={settings} lightning={lightningVal} />
          </Suspense>
        </Canvas>
      </div>

      {/* Editor Visibility Wrapper */}
      <div 
        className={`relative z-10 w-full h-full transition-opacity duration-700 ease-in-out ${showEditor ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Editor Overlays */}
        {notes.map(note => (
          <Editor 
            key={note.id}
            id={note.id}
            initialX={note.x}
            initialY={note.y}
            initialText={note.text}
            prompt={aiPrompt} 
            settings={settings}
            onDelete={deleteNote}
            onAdd={addNote}
            onFocus={() => bringToFront(note.id)}
            zIndex={note.zIndex}
            typewriterMode={note.id === 'main'} // Enable typewriter only for main note
          />
        ))}
        
        {/* Fallback if all notes deleted */}
        {notes.length === 0 && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <button 
                  className="pointer-events-auto px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white/70 hover:bg-white/20 transition-all font-hand text-xl"
                  onClick={() => addNote(window.innerWidth/2 - 225, window.innerHeight/2 - 250)}
               >
                  Start Writing
               </button>
           </div>
        )}
      </div>

      {/* Top Left Area */}
      <div className="fixed top-6 left-6 z-50 flex items-center gap-4">
        {/* Auto-Scene Button */}
        <button 
          onClick={() => setIsAutoScene(!isAutoScene)}
          className={`
            p-3 rounded-full 
            transition-all duration-300 ease-out group
            backdrop-blur-xl border shadow-[0_4px_16px_rgba(0,0,0,0.2)]
            focus:outline-none focus:ring-2 focus:ring-white/20
            hover:scale-105 active:scale-95
            ${isAutoScene 
              ? 'bg-teal-900/60 border-teal-500/50 text-teal-200 shadow-[0_0_15px_rgba(20,184,166,0.3)]' 
              : 'bg-white/5 border-white/10 text-stone-200 hover:bg-white/10 hover:border-white/20'
            }
          `}
          title={isAutoScene ? "Stop Auto-Generating Scenes" : "Auto-Generate Scenes (Every 2 min)"}
        >
          <div className="relative">
              {isSceneLoading ? (
                <Loader2 size={20} className="animate-spin text-teal-300" />
              ) : (
                <ImageIcon size={20} className={isAutoScene ? "text-teal-300" : ""} />
              )}
              
              {/* Active Indicator Dot */}
              {isAutoScene && !isSceneLoading && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
                  </span>
              )}
          </div>
        </button>

        {/* Poetic CTA Tooltip (Only visible if UI is shown) */}
        {showEditor && !isAutoScene && (
           <div className="pointer-events-none opacity-80 mix-blend-screen select-none">
             <TypewriterText 
                text="Start My Journey" 
                delay={2000}
                className="text-xs tracking-[0.2em] uppercase text-teal-200/80 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
             />
             <TypewriterText 
                text="Click to find your sanctuary" 
                delay={4500}
                className="text-[10px] tracking-widest text-white/50 italic mt-1 font-serif"
             />
           </div>
        )}
      </div>

      {/* Visibility Toggle Button */}
      <button 
        onClick={() => setShowEditor(!showEditor)}
        aria-label={showEditor ? "Hide Interface" : "Show Interface"}
        className={`
          fixed top-6 right-20 z-50 p-3 rounded-full 
          transition-all duration-300 ease-out
          backdrop-blur-xl border shadow-[0_4px_16px_rgba(0,0,0,0.2)]
          focus:outline-none focus:ring-2 focus:ring-white/20
          hover:scale-105 active:scale-95
          ${!showEditor 
            ? 'bg-teal-900/40 border-teal-500/30 text-teal-200' 
            : 'bg-white/5 border-white/10 text-stone-200 hover:bg-white/10 hover:border-white/20'
          }
        `}
      >
        {showEditor ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>

      {/* Controls Layer */}
      <Controls 
        settings={settings} 
        updateSettings={updateSettings} 
        onPromptGenerated={handlePrompt}
      />

    </main>
  );
};

export default App;
