
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Beer, RefreshCw, ChevronRight, Home, Flame, Skull, Ghost, Plus, Volume2, VolumeX, Edit2, Trash2, Save, X, PlusCircle, Sparkles, Zap, History, PlayCircle, Music, PartyPopper, Smile } from 'lucide-react';
import { CategoryType, Card, GameState } from './types';
import { INITIAL_CARDS } from './data';
import { GoogleGenAI, Modality } from "@google/genai";

// Robust Fisher-Yates Shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Audio Decoding Utilities
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const SUSPENSE_MESSAGES = [
  "Nạn nhân là ai đây? 🤔",
  "Chuẩn bị tinh thần đi! 😱",
  "Ai tiếp theo trúng mánh? 🔥",
  "Hồi hộp vãi chưởng... 🧨",
  "Thần cồn đang gọi tên... 🍺",
  "Tráo bài cực căng! ⚡",
  "Run chưa các đồng chí? 😂"
];

const App: React.FC = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    currentDeck: [],
    discardPile: [],
    currentCard: null,
    selectedCategory: null,
  });
  const [isFlipping, setIsFlipping] = useState(false);
  const [isSuspenseMode, setIsSuspenseMode] = useState(false);
  const [suspenseText, setSuspenseText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showReshuffleToast, setShowReshuffleToast] = useState(false);
  
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [newCardCategory, setNewCardCategory] = useState<CategoryType>(CategoryType.UNIVERSAL);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const savedCards = localStorage.getItem('drinking_game_cards');
    if (savedCards) {
      try {
        setCards(JSON.parse(savedCards));
      } catch (e) {
        setCards(INITIAL_CARDS);
      }
    } else {
      setCards(INITIAL_CARDS);
    }
  }, []);

  useEffect(() => {
    if (cards.length > 0) {
      localStorage.setItem('drinking_game_cards', JSON.stringify(cards));
    }
  }, [cards]);

  const speakCard = async (card: Card) => {
    if (!isVoiceEnabled) return;
    
    try {
      setIsSpeaking(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Bạn là một quản trò siêu hài hước, dâm đãng và lầy lội tại một quán nhậu Việt Nam. 
      Nội dung: "${card.content}". Hình phạt: "${card.penalty}". 
      Đọc to, rõ, có nhấn nhá như đang hô hào cả bàn nhậu!`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, 
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("TTS Error:", error);
      setIsSpeaking(false);
    }
  };

  const drawCard = useCallback(() => {
    if (isFlipping || isSuspenseMode) return;
    
    setIsSuspenseMode(true);
    setSuspenseText(SUSPENSE_MESSAGES[Math.floor(Math.random() * SUSPENSE_MESSAGES.length)]);
    setGameState(prev => ({ ...prev, currentCard: null }));

    setTimeout(() => {
      setIsSuspenseMode(false);
      setIsFlipping(true);

      setTimeout(() => {
        let drawn: Card | null = null;
        let reshuffled = false;

        setGameState(prev => {
          let deck = [...prev.currentDeck];
          let discard = [...prev.discardPile];

          if (deck.length === 0) {
            const allCategoryCards = cards.filter(c => c.category === prev.selectedCategory);
            deck = shuffleArray(allCategoryCards);
            discard = [];
            reshuffled = true;
          }

          if (deck.length === 0) return prev;
          drawn = deck.shift()!;
          
          return {
            ...prev,
            currentDeck: deck,
            discardPile: [...discard, drawn],
            currentCard: drawn,
          };
        });

        if (reshuffled) {
          setShowReshuffleToast(true);
          setTimeout(() => setShowReshuffleToast(false), 3000);
        }

        setIsFlipping(false);
        if (drawn) speakCard(drawn);
      }, 400);
    }, 1200); 
  }, [isFlipping, isSuspenseMode, cards, isVoiceEnabled]);

  const selectCategory = (category: CategoryType) => {
    const filtered = cards.filter(c => c.category === category);
    const shuffled = shuffleArray(filtered);
    setGameState({
      currentDeck: shuffled,
      discardPile: [],
      currentCard: null,
      selectedCategory: category,
    });
  };

  const resetGame = () => {
    setGameState({
      currentDeck: [],
      discardPile: [],
      currentCard: null,
      selectedCategory: null,
    });
  };

  const restoreDefaults = () => {
    if (window.confirm("Khôi phục toàn bộ thẻ bài gốc? 🔄")) {
      setCards(INITIAL_CARDS);
      localStorage.setItem('drinking_game_cards', JSON.stringify(INITIAL_CARDS));
    }
  };

  const addCard = (cardData: Omit<Card, 'id'>) => {
    const newCard = { ...cardData, id: Date.now().toString() };
    setCards(prev => [...prev, newCard]);
    setShowAddForm(false);
  };

  const updateCard = (updatedCard: Card) => {
    setCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
    setEditingCard(null);
  };

  const deleteCard = (id: string) => {
    if (window.confirm("Xóa thẻ này hả? Chắc chưa? 🤔")) {
      setCards(prev => prev.filter(c => c.id !== id));
    }
  };

  if (!gameState.selectedCategory) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Neon Orbs */}
        <div className="absolute top-[-5%] right-[-5%] w-72 h-72 bg-pink-600 rounded-full blur-[100px] opacity-30 animate-pulse" />
        <div className="absolute bottom-[-5%] left-[-5%] w-72 h-72 bg-cyan-600 rounded-full blur-[100px] opacity-30" />

        <div className="mb-10 text-center z-10 scale-110">
          <div className="relative inline-block mb-4">
             <Beer className="w-20 h-20 text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.8)] animate-bounce" />
             <PartyPopper className="w-8 h-8 text-pink-500 absolute -top-2 -right-2 animate-bounce delay-150" />
          </div>
          <h1 className="text-5xl sm:text-6xl font-bungee text-white tracking-widest drop-shadow-[0_0_10px_#ff00ff]">
            ZÔ ZÔ <span className="text-yellow-300">ZÔ!</span>
          </h1>
          <p className="text-cyan-300 mt-4 font-bold text-sm tracking-[0.2em] uppercase">Đồ uống đã sẵn sàng, còn bạn?</p>
        </div>

        <div className="w-full max-w-sm z-10 space-y-4">
          <button 
            onClick={() => selectCategory(CategoryType.UNIVERSAL)}
            className="w-full group relative p-10 rounded-[2.5rem] border-4 border-cyan-400 bg-black/40 text-center transition-all duration-300 active:scale-90 flex flex-col items-center overflow-hidden hover:border-pink-500 hover:shadow-[0_0_40px_rgba(255,0,255,0.4)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
               <PlayCircle className="w-12 h-12 text-yellow-300" />
            </div>
            <h3 className="text-3xl font-bungee text-white mb-2 tracking-tighter">VÀO TIỆC!</h3>
            <p className="text-cyan-400 text-xs font-black uppercase tracking-widest">{cards.length} Thách thức lầy lội</p>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-10 z-10 w-full max-w-xs sm:max-w-none justify-center">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border-2 border-white/10 flex items-center justify-center gap-2 transition-all text-white font-black text-xs uppercase tracking-widest shadow-lg"
          >
            <Edit2 className="w-4 h-4 text-pink-500" /> Kho bài
          </button>
          <button 
            onClick={restoreDefaults}
            className="px-6 py-3 bg-cyan-600/10 hover:bg-cyan-600/20 rounded-2xl border-2 border-cyan-500/30 flex items-center justify-center gap-2 transition-all text-cyan-300 font-black text-xs uppercase tracking-widest"
          >
            <RefreshCw className="w-4 h-4" /> Reset bài
          </button>
        </div>
        
        <footer className="mt-12 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] z-10">
          Uống vui, đừng say quá! 🍺
        </footer>

        {isSidebarOpen && (
          <Sidebar 
            cards={cards} 
            onClose={() => setIsSidebarOpen(false)} 
            onDelete={deleteCard} 
            onEdit={setEditingCard} 
            onAdd={() => {
              setNewCardCategory(CategoryType.UNIVERSAL);
              setShowAddForm(true);
            }}
            onRestore={restoreDefaults}
          />
        )}

        {(showAddForm || editingCard) && (
          <CardForm 
            initialData={editingCard || undefined} 
            initialCategory={newCardCategory}
            onSave={editingCard ? updateCard : addCard} 
            onCancel={() => { setShowAddForm(false); setEditingCard(null); }} 
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#1a0b2e] text-white relative overflow-hidden h-[100dvh]">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full bg-dots opacity-20 pointer-events-none" />
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-pink-600 rounded-full blur-[100px] opacity-20" />
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-cyan-600 rounded-full blur-[100px] opacity-20" />

      {showReshuffleToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-pink-600 px-6 py-3 rounded-full shadow-[0_0_30px_rgba(255,0,255,0.6)] border-2 border-white/20 animate-pop-in flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="font-bungee text-[10px] tracking-widest whitespace-nowrap">ĐÃ XÀO BÀI! ⚡</span>
        </div>
      )}

      <header className="flex items-center justify-between p-4 z-10 border-b-2 border-white/5 backdrop-blur-xl shrink-0">
        <button onClick={resetGame} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
          <Home className="w-5 h-5 text-cyan-400" />
        </button>
        <div className="text-center overflow-hidden">
          <h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-pink-500">Party Mode</h2>
          <p className="text-lg font-bungee text-yellow-300 truncate max-w-[180px]">ZÔ ZÔ ZÔ!</p>
        </div>
        <button 
          onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
          className={`p-3 rounded-xl transition-all border-2 ${isVoiceEnabled ? 'bg-cyan-600/20 border-cyan-400 text-cyan-400' : 'bg-white/5 border-white/10 text-slate-500'}`}
        >
          {isVoiceEnabled ? <Volume2 className={`w-5 h-5 ${isSpeaking ? 'animate-pulse' : ''}`} /> : <VolumeX className="w-5 h-5" />}
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 z-10 relative">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full h-8 text-center pointer-events-none">
           {isSuspenseMode && (
             <p className="text-yellow-300 font-bungee text-sm italic tracking-widest animate-bounce px-4 truncate">
               {suspenseText}
             </p>
           )}
        </div>

        <div className={`relative w-full max-w-[290px] aspect-[2/3] perspective-1000 transition-all duration-300 ${isSuspenseMode ? 'animate-suspense scale-95' : ''}`}>
          <div className={`w-full h-full relative transition-all duration-700 preserve-3d ${gameState.currentCard ? 'rotate-y-180' : ''}`}>
            
            {/* Card Back */}
            <div className={`absolute inset-0 backface-hidden bg-gradient-to-br from-[#2d1250] to-[#1a0b2e] rounded-[3rem] border-4 border-cyan-400 shadow-[0_0_30px_rgba(0,255,255,0.3)] flex flex-col items-center justify-center p-8 overflow-hidden group`}>
              <div className="absolute top-0 left-0 w-full h-full bg-dots opacity-10" />
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-pink-500/20 rounded-full blur-xl" />
              
              <div className={`w-24 h-24 bg-cyan-400/10 rounded-full flex items-center justify-center mb-6 border-2 border-cyan-400/30 ${isSuspenseMode ? 'animate-ping' : 'animate-pulse'}`}>
                <Beer className="w-12 h-12 text-cyan-400 drop-shadow-[0_0_8px_#00ffff]" />
              </div>
              <h3 className="text-2xl font-bungee text-white text-center leading-tight">CHƯA XONG ĐÂU!</h3>
              {!isSuspenseMode && <p className="text-cyan-400 text-[10px] font-black mt-4 uppercase tracking-[0.4em] opacity-80 animate-pulse">Chạm để rút</p>}
            </div>

            {/* Card Front */}
            <div className={`absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-[3rem] border-4 border-pink-500 shadow-[0_0_40px_rgba(255,0,255,0.4)] overflow-hidden flex flex-col text-slate-900 ${gameState.currentCard ? 'animate-reveal-glow' : ''}`}>
              <div className="bg-pink-500 text-white p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 truncate">
                  <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
                  <span className="text-[10px] font-black tracking-widest uppercase truncate">{gameState.currentCard?.title}</span>
                </div>
                <Music className={`w-4 h-4 text-yellow-300 ${isSpeaking ? 'animate-bounce' : ''}`} />
              </div>
              
              <div className="flex-1 flex flex-col p-6 justify-center relative bg-dots text-center">
                <div className="mb-6 z-10">
                  <span className="text-[10px] font-black text-pink-600 block mb-3 uppercase tracking-widest bg-pink-50 px-4 py-1 rounded-full inline-block">MÀN NÀY LÀ...</span>
                  <p className="text-xl sm:text-2xl font-black leading-tight text-slate-900 drop-shadow-sm">
                    {gameState.currentCard?.content}
                  </p>
                </div>

                <div className="mt-4 pt-6 border-t-2 border-dashed border-pink-100 z-10">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Skull className="w-4 h-4 text-red-500" />
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">HÌNH PHẠT</span>
                  </div>
                  <p className="text-lg font-extrabold text-slate-600 italic bg-yellow-100 p-3 rounded-2xl border-2 border-yellow-200">
                    🔥 {gameState.currentCard?.penalty}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 text-center shrink-0">
                <p className="text-[9px] text-pink-500 font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                  <Smile className="w-3 h-3" /> CHƠI KHÔNG QUẠU <Smile className="w-3 h-3" />
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 w-full max-w-[290px] space-y-4 shrink-0 pb-6">
          <button 
            onClick={drawCard}
            disabled={isFlipping || isSuspenseMode}
            className={`w-full py-5 px-8 bg-pink-500 text-white rounded-[2rem] font-bungee text-xl shadow-[0_8px_0_#9d174d] hover:shadow-[0_4px_0_#9d174d] active:shadow-none active:translate-y-2 transition-all flex items-center justify-center gap-3 ${(isFlipping || isSuspenseMode) ? 'opacity-50 cursor-not-allowed scale-95 translate-y-2 shadow-none' : 'hover:scale-105 active:scale-95'}`}
          >
            {isSuspenseMode ? 'ĐANG LỌC...' : (gameState.currentCard ? 'TIẾP TỤC' : 'RÚT NGAY')}
            <ChevronRight className={`w-6 h-6 ${isSuspenseMode ? 'animate-spin' : ''}`} />
          </button>
          
          <div className="flex gap-2">
             <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/5 rounded-2xl border border-white/10 text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                <History className="w-3 h-3" />
                <span>{gameState.discardPile.length}/{gameState.currentDeck.length + gameState.discardPile.length} BÀI</span>
             </div>
            <button 
               onClick={() => selectCategory(gameState.selectedCategory!)}
               className="px-6 py-3 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-300 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all border-2 border-cyan-500/20"
            >
              <RefreshCw className="w-3 h-3" />
              XÀO
            </button>
          </div>
        </div>
      </main>

      <div className="fixed bottom-6 right-6 z-20 flex flex-col gap-3">
        <button onClick={() => setIsSidebarOpen(true)} className="w-14 h-14 bg-pink-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,0,255,0.4)] border-2 border-white/20 active:scale-90 transition-transform">
          <PlusCircle className="w-7 h-7 text-white" />
        </button>
      </div>

      {isSidebarOpen && (
        <Sidebar 
          cards={cards} 
          onClose={() => setIsSidebarOpen(false)} 
          onDelete={deleteCard} 
          onEdit={setEditingCard} 
          onAdd={() => {
            setNewCardCategory(gameState.selectedCategory || CategoryType.UNIVERSAL);
            setShowAddForm(true);
          }}
          onRestore={restoreDefaults}
        />
      )}

      {(showAddForm || editingCard) && (
        <CardForm 
          initialData={editingCard || undefined} 
          initialCategory={newCardCategory}
          onSave={editingCard ? updateCard : addCard} 
          onCancel={() => { setShowAddForm(false); setEditingCard(null); }} 
        />
      )}
    </div>
  );
};

// --- Subcomponents ---

interface SidebarProps {
  cards: Card[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit: (card: Card) => void;
  onAdd: () => void;
  onRestore: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ cards, onClose, onDelete, onEdit, onAdd, onRestore }) => {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex justify-end">
      <div className="w-full max-w-sm bg-[#1a0b2e] h-full flex flex-col shadow-2xl animate-slide-in border-l-2 border-white/5">
        <div className="p-6 border-b-2 border-white/5 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bungee flex items-center gap-3 text-cyan-400 uppercase tracking-widest">
            <Edit2 className="w-5 h-5" /> KHO BÀI
          </h3>
          <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-dots">
          {cards.length > 0 ? (
            cards.map(card => (
              <div key={card.id} className="p-5 bg-white/5 border-2 border-white/10 rounded-[2rem] group active:bg-white/10 transition-all hover:border-pink-500/50">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-black text-cyan-400 text-[11px] uppercase truncate flex-1 pr-2 tracking-widest">{card.title}</h4>
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(card)} className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/10 active:scale-90">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(card.id)} className="p-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/10 active:scale-90">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-snug mb-3 font-bold break-words">{card.content}</p>
                <div className="text-[9px] font-black text-pink-400 uppercase tracking-widest bg-pink-500/10 px-4 py-1.5 rounded-full inline-block border border-pink-500/20">
                  PHẠT: {card.penalty}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-600 text-center p-6">
              <Beer className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-xs font-black uppercase tracking-widest">Không có bài... buồn vậy? 😢</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t-2 border-white/5 bg-[#1a0b2e] flex flex-col gap-3 shrink-0">
          <button 
            onClick={onAdd}
            className="w-full py-4 bg-pink-500 hover:bg-pink-400 text-white rounded-2xl font-bungee text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" /> THÊM THỬ THÁCH
          </button>
          <button 
            onClick={onRestore}
            className="w-full py-3 border-2 border-white/10 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all hover:text-white"
          >
            RESET MẶC ĐỊNH
          </button>
        </div>
      </div>
    </div>
  );
};

interface CardFormProps {
  initialData?: Card;
  initialCategory: CategoryType;
  onSave: (card: any) => void;
  onCancel: () => void;
}

const CardForm: React.FC<CardFormProps> = ({ initialData, initialCategory, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || `Lá bài #${Math.floor(Math.random() * 999)}`,
    content: initialData?.content || '',
    penalty: initialData?.penalty || '',
    category: initialData?.category || initialCategory
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content || !formData.penalty) return alert("Điền đủ vào, đừng lười! 😂");
    onSave(initialData ? { ...formData, id: initialData.id } : formData);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60] flex items-center justify-center p-6">
      <form 
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[#2d1250] border-4 border-cyan-400 rounded-[3rem] p-8 shadow-3xl animate-pop-in relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 to-cyan-400" />
        <div className="absolute top-0 left-0 w-full h-full bg-dots opacity-10 pointer-events-none" />
        
        <h3 className="text-2xl font-bungee text-white mb-8 flex items-center gap-3 tracking-widest">
          {initialData ? <Edit2 className="text-cyan-400" /> : <PlusCircle className="text-pink-500 w-8 h-8" />}
          {initialData ? 'SỬA BÀI' : 'BÀI MỚI'}
        </h3>

        <div className="space-y-5 relative z-10">
          <div>
            <label className="block text-[10px] font-black text-pink-500 uppercase tracking-[0.3em] mb-3 ml-1">Tên bài cực bốc</label>
            <input 
              type="text"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full bg-black/40 border-2 border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-cyan-400 transition-all font-bold"
              placeholder="Ví dụ: Say vãi chưởng..."
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-pink-500 uppercase tracking-[0.3em] mb-3 ml-1">Kèo này chơi sao?</label>
            <textarea 
              value={formData.content}
              onChange={e => setFormData({...formData, content: e.target.value})}
              rows={3}
              className="w-full bg-black/40 border-2 border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-cyan-400 resize-none transition-all font-bold"
              placeholder="Nhắn tin cho Ex..."
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-red-500 uppercase tracking-[0.3em] mb-3 ml-1">Phạt cái gì đây?</label>
            <input 
              type="text"
              value={formData.penalty}
              onChange={e => setFormData({...formData, penalty: e.target.value})}
              className="w-full bg-black/40 border-2 border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-red-500 transition-all font-bold"
              placeholder="Uống 3 chén!"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-10">
          <button 
            type="button"
            onClick={onCancel}
            className="py-4 px-4 rounded-2xl border-2 border-white/10 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all"
          >
            THÔI BỎ
          </button>
          <button 
            type="submit"
            className="py-4 px-4 rounded-2xl bg-cyan-400 text-slate-900 font-bungee text-[10px] tracking-widest shadow-lg shadow-cyan-400/20 active:scale-95 transition-all"
          >
            LƯU LẠI
          </button>
        </div>
      </form>
    </div>
  );
};

export default App;
