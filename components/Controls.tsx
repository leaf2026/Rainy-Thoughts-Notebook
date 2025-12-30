import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Upload, Eye, X, Sparkles, Repeat } from 'lucide-react';
import { AppSettings } from '../types';
import { generateWritingPrompt } from '../services/geminiService';

interface ControlsProps {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  onPromptGenerated: (prompt: string) => void;
}

const Controls: React.FC<ControlsProps> = ({ settings, updateSettings, onPromptGenerated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateSettings({ backgroundUrl: url });
    }
  };

  const handleSpark = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    const prompt = await generateWritingPrompt();
    onPromptGenerated(prompt);
    setIsGenerating(false);
  }, [isGenerating, onPromptGenerated]);

  // Auto-play effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoPlay) {
      // Trigger immediately on enable if not generating
      if (!isGenerating) handleSpark();
      
      interval = setInterval(() => {
        handleSpark();
      }, 120000); // 120 seconds (2 minutes)
    }
    return () => clearInterval(interval);
  }, [autoPlay, handleSpark]);

  const Slider = ({ label, value, min, max, step, onChange, unit = "" }: any) => (
    <div className="group space-y-2">
      <div className="flex justify-between text-[11px] tracking-widest font-bold uppercase">
        <span className="text-white/80 group-hover:text-white transition-colors shadow-sm">{label}</span>
        <span className="text-white/60 font-mono group-hover:text-white transition-colors">{typeof value === 'number' ? value.toFixed(unit === '%' ? 0 : 2) : value}{unit}</span>
      </div>
      <div className="relative h-4 flex items-center">
         <input 
          type="range" min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full appearance-none h-[2px] bg-white/20 rounded-lg cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[1px] 
            [&::-webkit-slider-thumb]:border-black/10 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.8)]
            hover:[&::-webkit-slider-thumb]:scale-125 hover:[&::-webkit-slider-thumb]:bg-white transition-all"
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close Settings" : "Open Settings"}
        className={`
          fixed top-6 right-6 z-50 p-3 rounded-full 
          transition-all duration-300 ease-out
          backdrop-blur-xl border shadow-[0_4px_16px_rgba(0,0,0,0.2)]
          focus:outline-none focus:ring-2 focus:ring-white/30
          hover:scale-105 active:scale-95
          ${isOpen 
            ? 'bg-neutral-900/60 border-white/20 text-white rotate-90' 
            : 'bg-white/5 border-white/10 text-stone-200 hover:bg-white/10 hover:border-white/20'
          }
        `}
      >
        {isOpen ? <X size={20} /> : <Settings size={20} />}
      </button>

      {/* Main Panel */}
      <div 
        className={`
          fixed top-20 right-0 md:right-6 bottom-6 w-full md:w-[340px] z-40
          bg-neutral-950/70 backdrop-blur-2xl border-l md:border border-white/10 md:rounded-2xl shadow-[0_10px_60px_rgba(0,0,0,0.6)]
          overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent
          transition-all duration-500 ease-out origin-top-right
          ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full md:translate-x-12 pointer-events-none'}
        `}
      >
        <div className="p-7 space-y-8">
          
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-white/10">
            <h2 className="text-xs font-bold tracking-[0.25em] text-white/90 uppercase drop-shadow-md">Settings</h2>
            <div className="flex gap-2">
               <button 
                onClick={() => setAutoPlay(!autoPlay)}
                className={`p-2 rounded transition-all ${autoPlay ? 'bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
                title={autoPlay ? "Stop Auto-Prompt (2 min)" : "Start Auto-Prompt (2 min)"}
              >
                <Repeat size={14} className={autoPlay ? 'animate-spin-slow' : ''} />
              </button>
               <button 
                onClick={handleSpark}
                disabled={isGenerating || autoPlay}
                className="p-2 rounded bg-white/5 hover:bg-white/10 text-white/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Generate Prompt Once"
              >
                <Sparkles size={14} className={isGenerating ? 'animate-pulse' : ''} />
              </button>
            </div>
          </div>

          {/* Media Source */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-2">Media</h3>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 border border-white/10 rounded bg-white/5 hover:bg-white/10 text-white/90 text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 group shadow-sm hover:shadow-md"
            >
              <Upload size={12} className="group-hover:-translate-y-0.5 transition-transform" /> 
              Upload Background
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />

            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold tracking-widest text-white/70 uppercase">Auto Fit</span>
              <button 
                onClick={() => updateSettings({ autoFitBackground: !settings.autoFitBackground })}
                className={`w-10 h-5 rounded-full relative transition-colors ${settings.autoFitBackground ? 'bg-white/30 shadow-inner' : 'bg-white/5'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full transition-all shadow-sm ${settings.autoFitBackground ? 'left-6 bg-white' : 'left-1 bg-white/30'}`} />
              </button>
            </div>
          </div>

          {/* Atmosphere */}
          <div className="space-y-4 pt-4 border-t border-white/10">
             <h3 className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-2">Atmosphere</h3>
             <Slider label="Rain Intensity" value={settings.rainIntensity * 100} min={0} max={100} step={1} unit="%" onChange={(v: number) => updateSettings({ rainIntensity: v / 100 })} />
             <Slider label="Drop Size" value={settings.rainDropletSize} min={0.5} max={2.0} step={0.1} onChange={(v: number) => updateSettings({ rainDropletSize: v })} />
             <Slider label="Storm" value={settings.stormIntensity * 100} min={0} max={100} step={1} unit="%" onChange={(v: number) => updateSettings({ stormIntensity: v / 100 })} />
             <Slider label="Glass Blur" value={settings.glassBlur * 100} min={0} max={100} step={1} unit="%" onChange={(v: number) => updateSettings({ glassBlur: v / 100 })} />
             <Slider label="Speed" value={settings.rainSpeed} min={0.1} max={3.0} step={0.1} unit="x" onChange={(v: number) => updateSettings({ rainSpeed: v })} />
             
             {/* Audio embedded in Atmosphere */}
             <div className="flex justify-between items-center pt-2">
                <span className="text-[10px] font-bold tracking-widest text-white/70 uppercase">Rain Audio</span>
                <button 
                  onClick={() => updateSettings({ isAudioPlaying: !settings.isAudioPlaying })}
                  className={`w-10 h-5 rounded-full relative transition-colors ${settings.isAudioPlaying ? 'bg-white/30 shadow-inner' : 'bg-white/5'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full transition-all shadow-sm ${settings.isAudioPlaying ? 'left-6 bg-white' : 'left-1 bg-white/30'}`} />
                </button>
             </div>
             {settings.isAudioPlaying && (
                 <Slider label="Volume" value={settings.audioVolume * 100} min={0} max={100} step={1} unit="%" onChange={(v: number) => updateSettings({ audioVolume: v / 100 })} />
             )}
          </div>

          {/* Optics */}
          <div className="space-y-4 pt-4 border-t border-white/10">
             <h3 className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-2">Optics</h3>
             <Slider label="Refraction" value={settings.refraction * 100} min={0} max={200} step={1} unit="%" onChange={(v: number) => updateSettings({ refraction: v / 100 })} />
             <Slider label="Zoom" value={settings.zoom * 100} min={50} max={200} step={1} unit="%" onChange={(v: number) => updateSettings({ zoom: v / 100 })} />
          </div>

          {/* Image */}
          <div className="space-y-4 pt-4 border-t border-white/10">
             <h3 className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-2">Image</h3>
             <Slider label="Brightness" value={settings.brightness} min={0} max={2.0} step={0.05} onChange={(v: number) => updateSettings({ brightness: v })} />
             <Slider label="Contrast" value={settings.contrast} min={0} max={2.0} step={0.05} onChange={(v: number) => updateSettings({ contrast: v })} />
          </div>

          {/* Interface Card */}
          <div className="space-y-4 pt-4 border-t border-white/10 pb-4">
             <h3 className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-2">Card Style</h3>
             <Slider label="Opacity" value={settings.editorOpacity} min={0} max={100} step={1} unit="%" onChange={(v: number) => updateSettings({ editorOpacity: v })} />
             <Slider label="Blur" value={settings.editorBlur} min={0} max={50} step={1} unit="px" onChange={(v: number) => updateSettings({ editorBlur: v })} />
             <Slider label="Radius" value={settings.editorRadius} min={0} max={50} step={1} unit="px" onChange={(v: number) => updateSettings({ editorRadius: v })} />
             <Slider label="Noise" value={settings.editorNoise} min={0} max={50} step={1} unit="%" onChange={(v: number) => updateSettings({ editorNoise: v })} />
             <Slider label="Shadow" value={settings.editorShadow} min={0} max={100} step={1} unit="%" onChange={(v: number) => updateSettings({ editorShadow: v })} />
          </div>

        </div>
      </div>
    </>
  );
};

export default Controls;