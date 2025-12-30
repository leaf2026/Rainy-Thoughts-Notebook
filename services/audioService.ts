/**
 * Audio Service (Enhanced)
 * 
 * Design Philosophy:
 * - Rain/Wind: Continuous loops (Ambience)
 * - Thunder: Probabilistic Events (One-shot, Delayed, Pitch-shifted)
 */

// Ambient Loops
let rainAudio: HTMLAudioElement | null = null;
let forestAudio: HTMLAudioElement | null = null;
let windAudio: HTMLAudioElement | null = null;
let musicAudio: HTMLAudioElement | null = null;

// Event Pool (Thunder)
// We keep a pool of audio objects to allow overlapping thunder if necessary
const THUNDER_POOL_SIZE = 4;
const thunderPool: HTMLAudioElement[] = [];

let isInitialized = false;

// Assets
const RAIN_URL = "https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg";
const FOREST_RAIN_URL = "https://actions.google.com/sounds/v1/weather/rain_on_roof.ogg";
const THUNDER_URL_1 = "https://actions.google.com/sounds/v1/weather/thunder_heavy.ogg"; // Deep
const THUNDER_URL_2 = "https://actions.google.com/sounds/v1/weather/thunder_claps.ogg"; // Crack
const WIND_URL = "https://actions.google.com/sounds/v1/weather/outdoor_rain.ogg"; 
const MUSIC_URL = "https://cdn.pixabay.com/audio/2022/03/09/audio_c8c8a73467.mp3"; 

export const initAudio = () => {
  if (isInitialized) return;

  // 1. Initialize Ambient Loops
  rainAudio = new Audio(RAIN_URL);
  rainAudio.loop = true;
  rainAudio.crossOrigin = "anonymous";
  
  forestAudio = new Audio(FOREST_RAIN_URL);
  forestAudio.loop = true;
  forestAudio.crossOrigin = "anonymous";
  
  windAudio = new Audio(WIND_URL);
  windAudio.loop = true;
  windAudio.crossOrigin = "anonymous";
  
  musicAudio = new Audio(MUSIC_URL);
  musicAudio.loop = true;
  musicAudio.crossOrigin = "anonymous";

  // 2. Initialize Thunder Pool (One-Shots)
  // Alternating sources for variety
  for (let i = 0; i < THUNDER_POOL_SIZE; i++) {
      const src = i % 2 === 0 ? THUNDER_URL_1 : THUNDER_URL_2;
      const audio = new Audio(src);
      audio.loop = false; // Important: Events are not loops
      audio.crossOrigin = "anonymous";
      thunderPool.push(audio);
  }

  // Start Muted
  [rainAudio, forestAudio, windAudio, musicAudio].forEach(a => {
      if(a) a.volume = 0;
  });

  const startPlayback = async () => {
    try {
      const promises = [
        rainAudio?.play(),
        forestAudio?.play(),
        windAudio?.play(),
        musicAudio?.play()
      ];
      await Promise.allSettled(promises);
    } catch (e) {
      console.debug("Audio autoplay blocked, waiting for user interaction");
    }
  };

  startPlayback();
  isInitialized = true;
};

// Global Volume applies mainly to the continuous ambient layers
// Thunder events calculate their own volume based on distance + globalScalar
let globalVolumeScalar = 1.0;

export const setGlobalVolume = (volume: number) => {
  globalVolumeScalar = Math.max(0, Math.min(1, volume));
  
  if (!rainAudio || !musicAudio) return;

  // Mapping intensity to volume layers
  rainAudio.volume = globalVolumeScalar * 0.7;       
  forestAudio.volume = globalVolumeScalar * 0.6;     
  if (windAudio) windAudio.volume = globalVolumeScalar * 0.4;
  musicAudio.volume = globalVolumeScalar * 0.15;     
};

/**
 * Triggers a thunder event.
 * @param distance 0.0 (Close/Loud) to 1.0 (Far/Quiet)
 */
export const triggerThunder = (distance: number) => {
    if (!isInitialized || globalVolumeScalar <= 0.05) return;

    // 1. Find a free audio channel in the pool
    const freeNode = thunderPool.find(a => a.paused) || thunderPool[0];
    
    // 2. Calculate Physics
    // Delay: Sound travels ~343m/s.
    // Simulating distance: 0 = immediate, 1 = ~4-5 seconds delay
    const delayMs = distance * 4000 + (Math.random() * 500);
    
    // Volume: Inverse square law (approx)
    // Close = 1.0, Far = 0.2
    const eventVolume = Math.max(0.1, (1.0 - distance) * 0.8) * globalVolumeScalar;
    
    // Pitch (Playback Rate):
    // Close = Sharp, faster (1.0 - 1.2)
    // Far = Low rumble, slower (0.6 - 0.9)
    const rate = 1.1 - (distance * 0.5) + (Math.random() * 0.1);

    // 3. Schedule the sound
    setTimeout(() => {
        freeNode.volume = eventVolume;
        freeNode.playbackRate = rate;
        freeNode.currentTime = 0;
        freeNode.play().catch(e => console.warn("Thunder blocked", e));
    }, delayMs);
};

export const resumeAudioContext = () => {
  [rainAudio, forestAudio, windAudio, musicAudio].forEach(a => {
      if (a && a.paused) a.play().catch(() => {});
  });
};