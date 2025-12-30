import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, GripHorizontal, Move, Clock, Copy, Check } from 'lucide-react';
import { AppSettings } from '../types';

interface EditorProps {
  id: string;
  initialText?: string;
  initialX?: number;
  initialY?: number;
  prompt: string | null;
  settings: AppSettings;
  onDelete: (id: string) => void;
  onAdd: (x: number, y: number) => void;
  onFocus: () => void;
  zIndex: number;
  typewriterMode?: boolean;
}

const Editor: React.FC<EditorProps> = ({ 
  id, 
  initialText = '', 
  initialX, 
  initialY, 
  prompt, 
  settings, 
  onDelete, 
  onAdd,
  onFocus,
  zIndex,
  typewriterMode = false
}) => {
  // Use a unique key for local storage based on ID
  const storageKey = `rainy-thoughts-content-${id}`;
  const hasLoadedFromStorage = useRef(false);
  
  // Track if user has manually moved the card. 
  // If false, we keep the 'main' card centered on resize.
  const [hasMoved, setHasMoved] = useState(false);

  const [text, setText] = useState(() => {
    let storedVal: string | null = null;
    if (id === 'main') {
        storedVal = localStorage.getItem('rainy-thoughts-content');
    } else {
        storedVal = localStorage.getItem(storageKey);
    }

    if (storedVal !== null) {
      hasLoadedFromStorage.current = true;
      return storedVal;
    }
    
    // If typewriter mode is requested and we have no stored text, start empty
    if (typewriterMode) return '';
    
    return initialText;
  });

  // Typewriter Effect Logic
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    // Only run if requested, not loaded from storage, and text is currently empty (or starting)
    if (typewriterMode && !hasLoadedFromStorage.current && initialText && text === '') {
      isTypingRef.current = true;
      let currentIndex = 0;
      
      // Clear any existing interval
      if (typewriterRef.current) clearInterval(typewriterRef.current);

      typewriterRef.current = setInterval(() => {
        if (currentIndex < initialText.length) {
          setText(prev => initialText.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          if (typewriterRef.current) clearInterval(typewriterRef.current);
          isTypingRef.current = false;
        }
      }, 35); // Speed of typing (ms)

      return () => {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
      };
    }
  }, []); // Run once on mount

  const [showPrompt, setShowPrompt] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Responsive Dimensions Initialization
  const [dimensions, setDimensions] = useState(() => {
      const isMobile = window.innerWidth < 768;
      // On mobile, use 90% width for consistency
      const w = isMobile ? Math.min(450, window.innerWidth * 0.9) : 450;
      const h = isMobile ? Math.min(500, window.innerHeight * 0.6) : 500;
      return { width: w, height: h };
  });

  const [position, setPosition] = useState(() => {
      const isMobile = window.innerWidth < 768;
      const w = isMobile ? Math.min(450, window.innerWidth * 0.9) : 450;
      const h = isMobile ? Math.min(500, window.innerHeight * 0.6) : 500;
      
      if (isMobile) {
          // Force center on mount for mobile to avoid initial cut-off
          return {
             x: (window.innerWidth - w) / 2,
             y: initialY ?? (window.innerHeight - h) / 2
          };
      }
      
      return { 
        x: initialX ?? (window.innerWidth - w) / 2, 
        y: initialY ?? (window.innerHeight - h) / 2 
      };
  });
  
  // Force position check on mount & resize to ensure visibility
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      
      // 1. Calculate New Dimensions
      let newW = dimensions.width;
      let newH = dimensions.height;
      
      if (isMobile) {
          newW = Math.min(450, window.innerWidth * 0.9);
          newH = Math.min(500, window.innerHeight * 0.6);
      } else {
          // Desktop constraint: prevent overflow
          newW = Math.min(dimensions.width, window.innerWidth - 40);
          newH = Math.min(dimensions.height, window.innerHeight - 100);
      }
      
      setDimensions({ width: newW, height: newH });

      // 2. Calculate New Position (Strict Boundaries & Centering)
      setPosition(prev => {
        let x = prev.x;
        let y = prev.y;
        
        if (isMobile) {
             // Always Center X on mobile resize to keep it visible
             x = (window.innerWidth - newW) / 2;
             // Clamp Y
             if (y + newH > window.innerHeight - 80) y = window.innerHeight - newH - 80;
             if (y < 60) y = 60;
        } else {
             // Desktop Logic
             
             // If this is the main note and the user hasn't manually moved it, 
             // keep it centered like a "Zen" mode.
             if (id === 'main' && !hasMoved) {
                 x = (window.innerWidth - newW) / 2;
                 y = (window.innerHeight - newH) / 2;
             } else {
                 // Standard Clamping: Respect user position but prevent off-screen
                 const rightEdge = x + newW;
                 if (rightEdge > window.innerWidth - 20) {
                     x = window.innerWidth - newW - 20;
                 }
                 if (x < 20) x = 20;
                 
                 if (y + newH > window.innerHeight - 20) y = window.innerHeight - newH - 20;
                 if (y < 60) y = 60; // Avoid overlapping top bar
             }
        }

        return { x, y };
      });
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hasMoved, id]); // Re-bind if hasMoved changes to ensure correct logic

  const [secondsActive, setSecondsActive] = useState(0);

  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (id === 'main') {
        localStorage.setItem('rainy-thoughts-content', text);
    } else {
        localStorage.setItem(storageKey, text);
    }
  }, [text, id, storageKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsActive(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (prompt) {
      setShowPrompt(true);
      const timer = setTimeout(() => setShowPrompt(false), 45000); // 45 seconds read time
      return () => clearTimeout(timer);
    }
  }, [prompt]);

  // Combined Mouse & Touch Move Handler
  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (isResizing && editorRef.current) {
        const rect = editorRef.current.getBoundingClientRect();
        // Calculate new dimensions relative to the top-left of the editor
        const newWidth = Math.max(300, Math.min(window.innerWidth - 20, clientX - rect.left));
        const newHeight = Math.max(200, Math.min(window.innerHeight - 20, clientY - rect.top));
        
        setDimensions({ width: newWidth, height: newHeight });
        return;
      }

      if (isDragging) {
        const newX = clientX - dragOffset.current.x;
        const newY = clientY - dragOffset.current.y;
        setPosition({ x: newX, y: newY });
      }
    };

    const onMouseMove = (e: MouseEvent) => {
        handleMove(e.clientX, e.clientY);
    };
    
    const onTouchMove = (e: TouchEvent) => {
        if (isDragging || isResizing) {
             e.preventDefault(); // Prevent scrolling while dragging
        }
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const onEnd = () => {
      if (isResizing) {
        setIsResizing(false);
        document.body.style.cursor = 'default';
      }
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isResizing || isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onEnd);
      
      // Touch listeners need { passive: false } to allow preventDefault
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onEnd);
      
      document.body.style.cursor = isResizing ? 'nwse-resize' : 'grabbing';
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isResizing, isDragging]);

  const startDrag = (clientX: number, clientY: number) => {
    onFocus(); 
    setIsDragging(true);
    // Mark as manually moved, disabling auto-center on resize for desktop
    setHasMoved(true); 
    dragOffset.current = {
      x: clientX - position.x,
      y: clientY - position.y
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
     e.preventDefault(); e.stopPropagation();
     startDrag(e.clientX, e.clientY);
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
      e.stopPropagation(); // Don't trigger other elements
      // e.preventDefault() here might block text selection if attached to wrong element, 
      // but fine for the drag handle
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
  };

  const startResize = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault(); e.stopPropagation(); 
      setIsResizing(true); 
      // Resizing is also a manual intervention
      setHasMoved(true);
      onFocus();
  };

  // If user interacts while auto-typing, stop typing and show full text immediately
  const handleInteraction = () => {
    if (isTypingRef.current) {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        isTypingRef.current = false;
        setText(initialText); // Skip to end
    }
    onFocus();
    setIsFocused(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  return (
    <>
      {id === 'main' && (
        <div 
          className={`
            fixed top-6 left-1/2 -translate-x-1/2 z-[100]
            w-[90%] max-w-3xl text-center px-6 md:px-12 py-6 rounded-full
            border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.2)]
            text-stone-200 font-hand text-lg md:text-2xl tracking-wide leading-relaxed
            transition-all duration-1000 ease-out pointer-events-auto
            ${showPrompt && prompt ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 pointer-events-none'}
          `}
          style={{
            backdropFilter: 'blur(24px) saturate(150%)',
            background: 'rgba(255, 255, 255, 0.05)',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            fontFamily: '"Patrick Hand", cursive'
          }}
        >
          {prompt}
        </div>
      )}

      <div 
        ref={editorRef}
        onMouseDown={onFocus}
        onTouchStart={onFocus}
        className={`
          absolute
          transition-shadow duration-300 ease-out
          pointer-events-auto
          flex flex-col
          group
        `}
        style={{
          left: position.x,
          top: position.y,
          width: dimensions.width,
          height: dimensions.height,
          zIndex: zIndex,
          borderRadius: `${settings.editorRadius}px`,
          backdropFilter: `blur(${settings.editorBlur}px) saturate(${settings.editorSaturation}%)`,
          backgroundColor: `rgba(255, 255, 255, ${settings.editorOpacity / 100})`,
          boxShadow: `
            0 20px 50px -12px rgba(0, 0, 0, ${settings.editorShadow / 100}),
            inset 0 0 0 1px rgba(255, 255, 255, ${isFocused ? 0.08 : 0.03})
          `,
        }}
      >
        {/* Grain/Noise Overlay */}
        <div 
          className="absolute inset-0 bg-noise mix-blend-overlay pointer-events-none" 
          style={{ 
             opacity: settings.editorNoise / 100,
             borderRadius: `${settings.editorRadius}px`
          }} 
        />
        
        {/* Gradient Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{
            borderRadius: `${settings.editorRadius}px`,
            background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.01) 100%)'
          }}
        />

        {/* Drag Handle - Top Center - Touch Compatible */}
        <div 
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="absolute top-0 left-0 right-0 h-10 flex justify-center items-center cursor-grab active:cursor-grabbing z-30 group-hover:opacity-100 opacity-0 transition-opacity"
          title="Drag to move"
        >
          <div className="p-2 text-white/10 hover:text-white/40">
            <Move size={16} />
          </div>
        </div>

        {/* Toolbar - Top Right */}
        <div className="absolute top-4 right-4 flex gap-2 z-40">
           <button 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleCopy}
            className={`
              p-2 rounded-full transition-all cursor-pointer border border-white/20
              ${isCopied 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' 
                : 'bg-black/20 text-white/90 hover:bg-black/40 hover:text-white'
              }
            `}
            title="Copy to clipboard"
          >
            {isCopied ? <Check size={18} /> : <Copy size={18} />}
          </button>
          
          <button 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onAdd(position.x + dimensions.width + 20, position.y)}
            className="p-2 rounded-full bg-black/20 border border-white/20 text-white/90 hover:bg-black/40 hover:text-white transition-all cursor-pointer"
            title="New Note"
          >
            <Plus size={18} />
          </button>
          <button 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(id)}
            className="p-2 rounded-full bg-black/20 border border-white/20 text-white/90 hover:bg-red-500/30 hover:text-white hover:border-red-400/50 transition-all cursor-pointer"
            title="Delete this note"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Text Area */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={handleInteraction}
          onBlur={() => setIsFocused(false)}
          placeholder="Write your thoughts..."
          className="
            w-full h-full bg-transparent border-none outline-none resize-none 
            text-stone-100 text-lg md:text-xl leading-[1.6] 
            placeholder:text-white/20 placeholder:italic p-6 md:p-10 pt-12
            transition-colors duration-500 cursor-text
            relative z-10
          "
          style={{ 
            fontFamily: '"Patrick Hand", cursive',
            textShadow: '0 2px 5px rgba(0,0,0,0.5)',
            caretColor: 'rgba(255, 255, 255, 0.8)',
            fontWeight: 400,
          }}
          spellCheck={false}
        />

        {/* Footer Info */}
        <div className="absolute bottom-6 left-8 flex items-center gap-4 text-white/50 text-base font-hand tracking-wide select-none pointer-events-none z-20" style={{ fontFamily: '"Patrick Hand", cursive' }}>
          <div className="flex items-center gap-1.5">
             <Clock size={14} className="opacity-70"/>
             <span>{formatTime(secondsActive)}</span>
          </div>
          <div className="w-1 h-1 bg-white/30 rounded-full" />
          <div>
             {text.split(/\s+/).filter(w => w.length > 0).length} words
          </div>
        </div>

        {/* Resize Handle - Touch Compatible */}
        <div 
          onMouseDown={startResize}
          onTouchStart={startResize}
          className="absolute bottom-0 right-0 p-4 cursor-nwse-resize opacity-40 hover:opacity-100 text-white transition-opacity z-20"
        >
          <div className="bg-black/20 rounded-full p-1 backdrop-blur-sm">
             <GripHorizontal size={20} />
          </div>
        </div>

      </div>
    </>
  );
};

export default Editor;