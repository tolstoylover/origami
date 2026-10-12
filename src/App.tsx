import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/engine';
import { patterns, getUnlockedPatterns, getPattern } from './game/patterns';
import { PAPER_COLORS, WeatherType } from './game/types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [, forceUpdate] = useState(0);
  const [scene, setScene] = useState<string>('title');
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>(PAPER_COLORS[0]);
  const [weather, setWeather] = useState<WeatherType>('clear');
  const [muted, setMuted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [hint, setHint] = useState('');
  const [patternComplete, setPatternComplete] = useState(false);
  const [unlockedPatterns, setUnlockedPatterns] = useState<string[]>(['plane', 'boat']);
  const [showJournal, setShowJournal] = useState(false);
  const [creatureCount, setCreatureCount] = useState(0);
  const [craneCount, setCraneCount] = useState(0);

  const syncState = useCallback(() => {
    if (!engineRef.current) return;
    const state = engineRef.current.getState();
    setScene(state.scene);
    setSelectedPattern(state.selectedPattern);
    setSelectedColor(state.selectedColor);
    setWeather(state.weather);
    setMuted(state.settings.muted);
    setUnlockedPatterns([...state.unlockedPatterns]);
    setCreatureCount(state.creatures.length);
    setCraneCount(state.craneCount);
    
    const step = engineRef.current.getCurrentStep();
    setCurrentStep(state.paper.currentStep);
    setPatternComplete(engineRef.current.isPatternComplete());
    
    if (step) {
      setHint(step.hint);
      const pattern = getPattern(state.selectedPattern || '');
      setTotalSteps(pattern?.steps.length || 0);
    } else {
      setHint('');
      setTotalSteps(0);
    }
    
    forceUpdate(n => n + 1);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;
    engine.setStateChangeCallback(syncState);
    engine.start();
    
    return () => {
      engine.stop();
    };
  }, [syncState]);

  const handlePatternSelect = (id: string) => {
    if (!engineRef.current) return;
    if (!unlockedPatterns.includes(id)) return;
    engineRef.current.selectPattern(id);
    syncState();
  };

  const handleColorSelect = (color: string) => {
    if (!engineRef.current) return;
    engineRef.current.selectColor(color);
    syncState();
  };

  const handleRelease = () => {
    if (!engineRef.current) return;
    engineRef.current.releaseCreature();
    syncState();
  };

  const handleGoToDesk = () => {
    if (!engineRef.current) return;
    engineRef.current.goToDesk();
    syncState();
  };

  const handleGoToDiorama = () => {
    if (!engineRef.current) return;
    engineRef.current.goToDiorama();
    syncState();
  };

  const handleReset = () => {
    if (!engineRef.current) return;
    engineRef.current.resetPaper();
    syncState();
  };

  const handleWeather = (w: WeatherType) => {
    if (!engineRef.current) return;
    engineRef.current.setWeather(w);
    syncState();
  };

  const handleMute = () => {
    if (!engineRef.current) return;
    engineRef.current.setMuted(!muted);
    syncState();
  };

  const handleUndo = () => {
    if (!engineRef.current) return;
    engineRef.current.undo();
    syncState();
  };

  const availablePatterns = getUnlockedPatterns(unlockedPatterns);
  const currentPattern = selectedPattern ? getPattern(selectedPattern) : null;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#2a1f14]">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className={`game-canvas ${selectedPattern && scene === 'desk' ? 'folding' : ''}`}
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* UI Overlay */}
      {scene !== 'title' && scene !== 'paused' && (
        <div className="ui-overlay inset-0 flex flex-col justify-between p-4">
          {/* Top bar */}
          <div className="flex justify-between items-start">
            {/* Left: Navigation */}
            <div className="flex gap-2">
              {scene === 'diorama' && (
                <button onClick={handleGoToDesk} className="btn-paper">
                  ← Fold More
                </button>
              )}
              {scene === 'desk' && selectedPattern && (
                <button onClick={handleGoToDiorama} className="btn-paper">
                  View Sea →
                </button>
              )}
            </div>
            
            {/* Right: Settings */}
            <div className="flex gap-2 items-center">
              <button onClick={() => setShowJournal(true)} className="btn-paper text-sm" title="Folder's Journal">
                📖
              </button>
              <button onClick={handleMute} className="btn-paper text-lg" title={muted ? 'Unmute' : 'Mute'}>
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>
          
          {/* Center: Hint text (desk mode) */}
          {scene === 'desk' && selectedPattern && hint && !patternComplete && (
            <div className="flex justify-center">
              <div className="hint-text bg-[#f4ead5]/80 px-4 py-2 rounded-lg backdrop-blur-sm">
                <span className="text-xs opacity-60 mr-2">Step {currentStep + 1}/{totalSteps}</span>
                {hint}
              </div>
            </div>
          )}
          
          {/* Empty diorama hint */}
          {scene === 'diorama' && creatureCount === 0 && (
            <div className="flex justify-center">
              <div className="bg-[#f4ead5]/70 px-4 py-2 rounded-lg backdrop-blur-sm">
                <p className="text-xs text-[#6a5a4a] font-serif">
                  The sea is quiet... fold something and release it! 🌊
                </p>
              </div>
            </div>
          )}
          
          {/* Pattern complete message */}
          {patternComplete && scene === 'desk' && (
            <div className="flex justify-center">
              <div className="bg-[#f4ead5]/90 px-6 py-4 rounded-lg backdrop-blur-sm text-center">
                <p className="font-serif text-[#4a3a2a] text-lg mb-2">
                  ✨ {currentPattern?.name} complete!
                </p>
                {currentPattern?.hiddenMessage && (
                  <p className="hint-text text-sm italic mb-3">
                    "{currentPattern.hiddenMessage}"
                  </p>
                )}
                <button onClick={handleRelease} className="btn-paper bg-[#d4a843] text-white border-[#b08a32]">
                  Release into the Sea 🌊
                </button>
              </div>
            </div>
          )}
          
          {/* Bottom: Controls */}
          <div className="flex justify-between items-end">
            {/* Left: Pattern tray (desk mode) */}
            {scene === 'desk' && (
              <div className="flex flex-col gap-3">
                {/* Color swatches */}
                <div className="flex gap-2 bg-[#f4ead5]/80 p-2 rounded-lg backdrop-blur-sm">
                  {PAPER_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => handleColorSelect(color)}
                      className={`color-swatch ${selectedColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                
                {/* Pattern cards */}
                <div className="flex gap-2 bg-[#f4ead5]/80 p-2 rounded-lg backdrop-blur-sm">
                  {patterns.map(p => {
                    const isUnlocked = unlockedPatterns.includes(p.id);
                    const isActive = selectedPattern === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handlePatternSelect(p.id)}
                        className={`pattern-card ${isActive ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}`}
                        disabled={!isUnlocked}
                        title={isUnlocked ? p.name : `Unlocked after: ${p.unlockAfter}`}
                      >
                        <span className="text-xl">{p.icon}</span>
                        <span className="text-xs block mt-1 text-[#6a5a4a]">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
                
                {/* Action buttons */}
                <div className="flex gap-2">
                  {selectedPattern && (
                    <>
                      <button onClick={handleUndo} className="btn-paper" title="Undo (Ctrl+Z)">
                        ↩ Undo
                      </button>
                      <button onClick={handleReset} className="btn-paper" title="Reset sheet">
                        🔔 Reset
                      </button>
                    </>
                  )}
                  {!selectedPattern && (
                    <p className="hint-text bg-[#f4ead5]/60 px-3 py-2 rounded-lg">
                      Pick a pattern to start folding ✂️
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Right: Weather controls (diorama mode) */}
            {scene === 'diorama' && (
              <div className="flex flex-col gap-2 items-end">
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {(['clear', 'rain', 'wind', 'snow', 'starfall'] as WeatherType[]).map(w => (
                    <button
                      key={w}
                      onClick={() => handleWeather(w)}
                      className={`weather-btn ${weather === w ? 'active' : ''}`}
                    >
                      {w === 'clear' ? '☀️' : w === 'rain' ? '🌧' : w === 'wind' ? '💨' : w === 'snow' ? '❄️' : '⭐'}
                    </button>
                  ))}
                </div>
                
                {/* Creature count */}
                <div className="bg-[#f4ead5]/70 px-3 py-1 rounded-full text-xs text-[#6a5a4a]">
                  🎨 {creatureCount} creatures in the sea
                </div>
              </div>
            )}
            
            {/* Spacer for desk mode right side */}
            {scene === 'desk' && <div />}
          </div>
        </div>
      )}
      
      {/* Title screen overlay */}
      {scene === 'title' && (
        <div className="ui-overlay inset-0 flex flex-col items-center justify-end pb-12">
          <p className="text-[#f4ead5]/60 text-sm font-serif italic animate-pulse mb-2">
            Click anywhere to begin
          </p>
          <p className="text-[#f4ead5]/30 text-xs font-serif">
            A paper folding meditation
          </p>
        </div>
      )}
      
      {/* Onboarding hint (first time on desk) */}
      {scene === 'desk' && !selectedPattern && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 animate-fade-in">
          <div className="bg-[#f4ead5]/90 px-4 py-3 rounded-lg backdrop-blur-sm shadow-lg max-w-xs text-center">
            <p className="text-sm text-[#4a3a2a] font-serif">
              Welcome to your folding desk ✨
            </p>
            <p className="text-xs text-[#6a5a4a] mt-1">
              Start with the Paper Plane — it's quick and satisfying!
            </p>
            <div className="mt-2 text-lg">✈️ ← Pick a pattern below</div>
          </div>
        </div>
      )}
      
      {/* Journal Modal */}
      {showJournal && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/30">
          <div className="bg-[#f4ead5] rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-serif text-xl text-[#4a3a2a]">📖 Folder's Journal</h2>
              <button onClick={() => setShowJournal(false)} className="text-[#6a5a4a] hover:text-[#4a3a2a] text-xl">×</button>
            </div>
            
            <div className="space-y-3">
              <div className="bg-[#ede0c8] rounded-lg p-3">
                <p className="text-sm text-[#6a5a4a]">
                  <span className="font-semibold">Creatures released:</span> {creatureCount}
                </p>
                <p className="text-sm text-[#6a5a4a] mt-1">
                  <span className="font-semibold">Cranes folded:</span> {craneCount}
                  {craneCount >= 25 && ' ✨ Golden crane unlocked!'}
                </p>
              </div>
              
              <div className="bg-[#ede0c8] rounded-lg p-3">
                <p className="text-sm font-semibold text-[#6a5a4a] mb-2">Patterns mastered:</p>
                <div className="flex flex-wrap gap-2">
                  {patterns.map(p => (
                    <span
                      key={p.id}
                      className={`text-lg ${unlockedPatterns.includes(p.id) ? '' : 'opacity-30'}`}
                      title={unlockedPatterns.includes(p.id) ? p.name : 'Locked'}
                    >
                      {p.icon}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="bg-[#ede0c8] rounded-lg p-3">
                <p className="text-sm font-semibold text-[#6a5a4a] mb-2">Tips:</p>
                <ul className="text-xs text-[#6a5a4a] space-y-1">
                  <li>• Drag on the paper to fold along the crease</li>
                  <li>• Fold past 60% to snap the fold closed</li>
                  <li>• Release your creation into the sea!</li>
                  <li>• Try different weather in the diorama</li>
                  <li>• Click the sun for a surprise ☀️</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Accessibility: Live region for announcements */}
      <div aria-live="polite" className="sr-only">
        {hint && `Folding step: ${hint}`}
        {patternComplete && `${currentPattern?.name} complete. Ready to release.`}
      </div>
    </div>
  );
}
