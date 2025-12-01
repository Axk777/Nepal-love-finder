
import React, { useEffect, useState, useRef } from 'react';
import { User, Role } from '../types';
import { Button, GlassCard, Badge, Icons } from '../components/UI';
import { apiFindMatch, apiGetActiveMatch, apiGetOnlineCountAsync, apiCancelSearch } from '../services/mockBackend';
import { SAFETY_TIPS, HOROSCOPES } from '../constants';

interface DashboardProps {
  user: User;
  onNavigate: (view: any) => void;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate, onLogout }) => {
  const [onlineCount, setOnlineCount] = useState(1);
  const [finding, setFinding] = useState(false);
  const [searchTimeLeft, setSearchTimeLeft] = useState(0);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [error, setError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [dailyHoroscope, setDailyHoroscope] = useState('');
  
  // Celebration State
  const [matchFoundData, setMatchFoundData] = useState<User | null>(null);
  
  const isMounted = useRef(true);
  const findingRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    setDailyHoroscope(HOROSCOPES[Math.floor(Math.random() * HOROSCOPES.length)]);
    
    const updateStats = async () => {
        if(isMounted.current) {
            const count = await apiGetOnlineCountAsync();
            setOnlineCount(count);
        }
    };
    updateStats();

    const statsInterval = setInterval(updateStats, 10000);

    return () => {
        isMounted.current = false;
        clearInterval(statsInterval);
        if (findingRef.current) {
            apiCancelSearch(user.id);
        }
    };
  }, [user.id]);

  useEffect(() => {
    const checkActive = async () => {
      const active = await apiGetActiveMatch(user.id);
      if (active && isMounted.current) {
        findingRef.current = false;
        setFinding(false);
        setMatchFoundData(active.partner);
      }
    };
    checkActive();
    
    const pollInterval = setInterval(() => {
        if(findingRef.current) checkActive();
    }, 2000);
    return () => clearInterval(pollInterval);
  }, [user.id]);

  const handleFindMatch = async () => {
    if (finding) return;
    
    await apiCancelSearch(user.id);

    setFinding(true);
    findingRef.current = true;
    setError('');
    setShowSharePrompt(false);
    
    const duration = 45; 
    setSearchTimeLeft(duration);
    
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);
    
    const timerInterval = setInterval(() => {
        if (!isMounted.current) return;
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
        setSearchTimeLeft(remaining > 0 ? remaining : 0);
    }, 1000);

    try {
        const initialResult = await apiFindMatch(user.id);
        if (initialResult) {
            clearInterval(timerInterval);
            const fullMatch = await apiGetActiveMatch(user.id);
            if(fullMatch && isMounted.current) {
                setFinding(false);
                findingRef.current = false;
                setMatchFoundData(fullMatch.partner);
            }
            return;
        }
        
        while (Date.now() < endTime && isMounted.current && findingRef.current) {
            const res = await apiFindMatch(user.id); 
            if (res) {
                 clearInterval(timerInterval);
                 const fullMatch = await apiGetActiveMatch(user.id);
                 if(fullMatch && isMounted.current) {
                    setFinding(false);
                    findingRef.current = false;
                    setMatchFoundData(fullMatch.partner);
                 }
                 break;
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        clearInterval(timerInterval);
        
        if (!isMounted.current) return;
        if (!findingRef.current && matchFoundData) return; 

        const finalMatch = await apiGetActiveMatch(user.id);

        if (finalMatch) {
            setFinding(false);
            findingRef.current = false;
            setMatchFoundData(finalMatch.partner);
        } else {
            if (findingRef.current) {
                setFinding(false);
                findingRef.current = false;
                setShowSharePrompt(true);
                await apiCancelSearch(user.id);
            }
        }
    } catch (e: any) {
        clearInterval(timerInterval);
        if (isMounted.current) {
            setFinding(false);
            findingRef.current = false;
            setError(e.message || 'Matchmaking failed');
            apiCancelSearch(user.id);
        }
    }
  };

  const handleShare = async () => {
      if (navigator.share) {
          try {
              await navigator.share({
                  title: 'Nepali Love Finder',
                  text: 'Come find your soul mate on Nepali Love Finder!',
                  url: window.location.href,
              });
          } catch (error) {
              handleCopyLink();
          }
      } else {
          handleCopyLink();
      }
  };

  const handleCopyLink = () => {
      navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => {
          if (isMounted.current) setLinkCopied(false);
      }, 2000);
  };

  if (matchFoundData) {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      
      return (
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 animate-fade-in-up bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
              <div className="text-center space-y-8 w-full max-w-sm">
                  <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 animate-pulse tracking-tighter drop-shadow-2xl">
                      BOOM!
                  </h1>
                  
                  <div className="flex items-center justify-center gap-4 mt-8">
                      <div className="relative animate-pop-in" style={{ animationDelay: '0.1s' }}>
                          <img 
                            src={user.photoUrl || "https://picsum.photos/100/100"} 
                            className="w-24 h-24 rounded-full border-4 border-white shadow-[0_0_30px_rgba(255,255,255,0.5)] object-cover" 
                          />
                      </div>
                      
                      <div className="animate-bounce">
                          <Icons.Sparkle className="w-16 h-16 text-yellow-400 fill-current filter drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
                      </div>

                      <div className="relative animate-pop-in" style={{ animationDelay: '0.3s' }}>
                          <img 
                            src={matchFoundData.photoUrl || "https://picsum.photos/101/101"} 
                            className="w-24 h-24 rounded-full border-4 border-nepaliRed shadow-[0_0_30px_rgba(229,57,53,0.5)] object-cover" 
                          />
                      </div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                      <p className="text-white text-lg font-medium">
                          You and <span className="font-bold text-yellow-300">{matchFoundData.displayName}</span> are a match!
                      </p>
                      <p className="text-white/60 text-sm mt-1">Don't wait, say hello now.</p>
                  </div>

                  <Button 
                    onClick={() => onNavigate('CHAT')}
                    fullWidth
                    className="bg-white text-nepaliRed hover:bg-gray-100 font-black text-xl py-5 shadow-2xl transform transition hover:scale-105"
                  >
                      CHAT NOW
                  </Button>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 bg-[url('https://www.transparenttextures.com/patterns/diamond-upholstery.png')]">
      <header className="bg-white/80 backdrop-blur-lg shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-10 border-b border-gray-100">
        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-nepaliRed to-pink-600 flex items-center gap-2 tracking-tighter">
           <Icons.Heart className="w-7 h-7 fill-nepaliRed text-nepaliRed"/>
           Love Finder
        </h1>
        <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest border border-gray-200 px-2 py-1 rounded bg-gray-50 hidden sm:block">
                Created by AXK
            </span>
            <button onClick={onLogout} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all">
                <Icons.LogOut className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* Mobile Only Badge */}
      <div className="sm:hidden text-center -mt-2 mb-2 relative z-20">
          <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest bg-white/80 backdrop-blur px-2 py-0.5 rounded-b-lg border-b border-r border-l border-gray-100 shadow-sm">
                Created by AXK
          </span>
      </div>

      <main className="p-4 max-w-lg mx-auto space-y-6 mt-2">
        
        {/* Profile Glass Card */}
        <GlassCard className="flex flex-col gap-4 bg-gradient-to-br from-nepaliBlue/90 to-blue-600 text-white border-none shadow-xl shadow-blue-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="relative flex-shrink-0">
                <img 
                src={user.photoUrl || "https://picsum.photos/100/100"} 
                alt="Profile" 
                className="w-16 h-16 rounded-full border-4 border-white/30 object-cover shadow-lg" 
                />
                <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></span>
            </div>
            <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold truncate">{user.displayName}</h2>
                <p className="text-white/80 text-sm">{user.role} • {user.age} yrs</p>
            </div>
            <button 
                onClick={() => onNavigate('PROFILE')}
                className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full text-white text-xs font-bold transition-colors backdrop-blur-sm border border-white/20"
            >
                Edit
            </button>
          </div>

          {user.interests && user.interests.length > 0 && (
              <div className="flex flex-wrap gap-2 relative z-10 mt-1">
                  {user.interests.slice(0, 3).map((tag, i) => (
                      <span key={i} className="text-[10px] bg-black/20 px-2 py-0.5 rounded-md text-white/90">{tag}</span>
                  ))}
                  {user.interests.length > 3 && <span className="text-[10px] text-white/70">+{user.interests.length - 3} more</span>}
              </div>
          )}
        </GlassCard>

        {/* Stats & Horoscope */}
        <div className="grid grid-cols-2 gap-3">
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-1">
                <div className="relative flex h-4 w-4 mb-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
                </div>
                <span className="font-bold text-gray-800 text-lg">{onlineCount}</span>
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Online Now</span>
             </div>
             <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-2xl shadow-sm border border-orange-100 flex flex-col justify-center relative overflow-hidden">
                <div className="flex items-center gap-1 text-orange-600 mb-1">
                    <Icons.Star className="w-4 h-4 fill-current" />
                    <span className="text-xs font-bold uppercase tracking-wider">Daily Vibe</span>
                </div>
                <p className="text-xs text-gray-600 leading-tight font-medium italic">
                    "{dailyHoroscope}"
                </p>
             </div>
        </div>

        {/* Main Action Area */}
        <div className="py-6 text-center min-h-[300px] flex flex-col justify-center">
            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-2xl mb-6 text-sm flex items-center gap-3 shadow-sm border border-red-100">
                    <Icons.Alert className="w-5 h-5" />
                    {error}
                </div>
            )}

            {showSharePrompt ? (
                 <GlassCard className="animate-fade-in-up border-blue-100 bg-blue-50/50">
                    <div className="text-center p-2">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icons.User className="w-8 h-8 text-blue-500" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg mb-2">Everyone is busy!</h3>
                        <p className="text-sm text-gray-600 mb-6 px-4 leading-relaxed">
                            We couldn't find a match right now. <br/>
                            <span className="font-bold text-blue-600">Invite friends</span> to increase your chances!
                        </p>
                        <div className="flex flex-col gap-3">
                          <Button 
                              variant="primary"
                              fullWidth 
                              onClick={handleShare}
                              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-blue-500/30"
                          >
                             <Icons.Share className="w-4 h-4" />
                             Share App
                          </Button>
                          <Button 
                              variant="outline"
                              fullWidth 
                              onClick={handleCopyLink}
                              className="text-sm py-3"
                          >
                              {linkCopied ? 'Link Copied!' : 'Copy Link'}
                          </Button>
                        </div>
                        <button 
                            onClick={() => setShowSharePrompt(false)}
                            className="text-xs text-gray-500 hover:text-gray-800 font-bold mt-6 uppercase tracking-wide"
                        >
                            Back to Home
                        </button>
                    </div>
                 </GlassCard>
            ) : (
                <div className="relative flex justify-center items-center py-10">
                    {finding && (
                        <>
                            <div className="absolute w-72 h-72 border border-nepaliRed/30 rounded-full animate-ripple bg-nepaliRed/5"></div>
                            <div className="absolute w-72 h-72 border border-nepaliRed/20 rounded-full animate-ripple" style={{ animationDelay: '0.6s' }}></div>
                            <div className="absolute w-72 h-72 border-2 border-nepaliRed/10 rounded-full animate-ripple" style={{ animationDelay: '1.2s' }}></div>
                        </>
                    )}

                    <div className="relative z-10 w-full max-w-xs">
                        <Button 
                            onClick={handleFindMatch} 
                            isLoading={false} 
                            disabled={finding}
                            className={`w-full py-6 text-xl shadow-2xl shadow-red-500/40 transform transition-all duration-300 rounded-3xl ${finding ? 'bg-white text-nepaliRed border-2 border-nepaliRed scale-95' : 'bg-gradient-to-r from-nepaliRed to-pink-600 hover:scale-105 hover:-translate-y-1'}`}
                        >
                            {finding ? (
                              <span className="flex flex-col items-center">
                                <span className="font-black animate-pulse tracking-wide">SCANNING...</span>
                                <span className="text-xs font-bold bg-nepaliRed/10 px-3 py-1 rounded-full mt-2">{searchTimeLeft}s</span>
                              </span>
                            ) : (
                                <span className="font-black tracking-wide drop-shadow-md">FIND SOUL MATE</span>
                            )}
                        </Button>
                    </div>
                </div>
            )}
            
            {!showSharePrompt && !finding && (
                <div className="animate-fade-in-up mt-6 space-y-2">
                    <p className="text-gray-500 text-xs font-medium bg-white/50 inline-block px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
                        <span className="text-nepaliRed font-bold">Notice:</span> Only <span className="font-bold text-gray-800">Kta</span> & <span className="font-bold text-gray-800">Kti</span> are matched (Opposite Gender).
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pt-2">
                        🇳🇵 Made for Nepali Hearts 🇳🇵
                    </p>
                </div>
            )}
        </div>

        {/* Safety Tips */}
        <div className="bg-green-50/50 p-5 rounded-2xl border border-green-100">
            <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                <Icons.Shield className="w-4 h-4" /> Safety First
            </h3>
            <ul className="text-sm text-green-700 space-y-2 list-disc pl-4 opacity-80">
                {SAFETY_TIPS.map((tip, i) => (
                    <li key={i}>{tip}</li>
                ))}
            </ul>
        </div>

      </main>
    </div>
  );
};
