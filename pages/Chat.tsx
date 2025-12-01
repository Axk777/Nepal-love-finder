
import React, { useEffect, useState, useRef } from 'react';
import { User, Message, Match } from '../types';
import { apiGetActiveMatch, apiGetMessages, apiSendMessage, apiEndMatch, apiReportUser, apiBlockUser, subscribeToMessages } from '../services/mockBackend';
import { Icons, Badge } from '../components/UI';
import { ICEBREAKERS } from '../constants';

interface ChatProps {
  currentUser: User;
  onExit: () => void;
}

export const Chat: React.FC<ChatProps> = ({ currentUser, onExit }) => {
  const [matchData, setMatchData] = useState<{ match: Match; partner: User } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [randomIcebreakers, setRandomIcebreakers] = useState<string[]>([]);
  const [isExiting, setIsExiting] = useState(false); // New exiting state
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const matchIdRef = useRef<string | null>(null);

  useEffect(() => {
    const shuffled = [...ICEBREAKERS].sort(() => 0.5 - Math.random());
    setRandomIcebreakers(shuffled.slice(0, 3));
  }, []);

  useEffect(() => {
      matchIdRef.current = matchData?.match.id || null;
  }, [matchData]);

  useEffect(() => {
    let isMounted = true;
    let subscription: any = null;
    
    const fetchData = async () => {
      const data = await apiGetActiveMatch(currentUser.id);
      if (!data) {
        if(isMounted) onExit(); 
        return;
      }
      
      if(isMounted) {
          setMatchData(data);
          matchIdRef.current = data.match.id;

          const msgs = await apiGetMessages(data.match.chatRoomId);
          setMessages(msgs);

          subscription = subscribeToMessages(data.match.chatRoomId, (newMsg) => {
              if (!isMounted) return;

              if (newMsg === null) {
                  // Message was deleted or janitor ran -> Refresh list to sync UI
                  apiGetMessages(data.match.chatRoomId).then(freshMsgs => {
                      if (isMounted) setMessages(freshMsgs);
                  });
              } else {
                  // New message inserted
                  setMessages(prev => {
                      if (prev.find(m => m.id === newMsg.id)) return prev;
                      return [...prev, newMsg];
                  });
              }
          });
      }
    };

    fetchData();

    return () => {
        isMounted = false;
        if (subscription) subscription.unsubscribe();
    };
  }, [currentUser.id]);

  useEffect(() => {
    const statusInterval = setInterval(async () => {
        if (!matchIdRef.current || isExiting) return;
        const data = await apiGetActiveMatch(currentUser.id);
        if (!data) {
            // Partner ended chat
            onExit();
        }
    }, 3000); 

    return () => clearInterval(statusInterval);
  }, [currentUser.id, isExiting]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !matchData) return;
    const text = inputText;
    setInputText(''); 
    await apiSendMessage(matchData.match.chatRoomId, currentUser.id, text);
  };

  const handleEndChat = async (e?: React.MouseEvent) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    if(!matchData) return;
    
    // Close dropdown immediately
    setShowOptions(false);

    // Use a slight timeout to allow UI to update
    setTimeout(async () => {
        if(window.confirm("Are you sure you want to end this chat?")) {
            setIsExiting(true); 
            try {
                await apiEndMatch(matchData.match.id);
            } catch (e) {
                console.error("Error ending match", e);
            } finally {
                setMatchData(null); 
                onExit();
            }
        }
    }, 50);
  };

  const handleReport = async () => {
      if(!matchData) return;
      setShowOptions(false);
      const reason = prompt("Why are you reporting this user?");
      if(reason) {
          await apiReportUser(currentUser.id, matchData.partner.id, reason);
          alert("User reported. Admins will review.");
      }
  };

  const handleBlock = async () => {
      if(!matchData) return;
      setShowOptions(false);
      if(confirm(`Block ${matchData.partner.displayName}? You won't match again.`)) {
          setIsExiting(true);
          await apiBlockUser(currentUser.id, matchData.partner.id);
          onExit();
      }
  };

  if (!matchData || isExiting) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-gray-500 animate-pulse font-medium gap-3">
             <div className="w-10 h-10 border-4 border-nepaliRed border-t-transparent rounded-full animate-spin"></div>
             <p>{isExiting ? "Disconnecting..." : "Connecting to chat..."}</p>
        </div>
      );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Refined Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-20 border-b border-gray-100">
        <div className="flex items-center gap-3">
             <div className="relative">
                <img 
                    src={matchData.partner.photoUrl || 'https://picsum.photos/50/50'} 
                    className="w-11 h-11 rounded-full bg-gray-200 object-cover ring-2 ring-nepaliRed/10 p-0.5"
                    alt="Partner"
                />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
             </div>
             <div>
                 <h3 className="font-bold text-gray-900 leading-tight flex items-center gap-2 text-base">
                     {matchData.partner.displayName}
                 </h3>
                 <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full uppercase tracking-wider font-bold">{matchData.partner.role}</span>
                    {matchData.partner.interests && matchData.partner.interests.length > 0 && (
                        <span className="text-[10px] text-gray-400 truncate max-w-[100px] block">
                             • Likes {matchData.partner.interests[0]}
                        </span>
                    )}
                 </div>
             </div>
        </div>
        
        <div className="flex items-center gap-1">
            {/* Direct Exit Button for Easy Access */}
            <button 
                onClick={handleEndChat}
                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors active:scale-95"
                title="End Chat Immediately"
            >
                <Icons.LogOut className="w-6 h-6" />
            </button>

            <div className="relative">
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }} 
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors active:bg-gray-200"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </button>
                
                {showOptions && (
                    <>
                    {/* Fixed Backdrop (z-40) */}
                    <div className="fixed inset-0 z-40 bg-black/5" onClick={() => setShowOptions(false)}></div>
                    {/* Fixed Menu (z-50) - Escapes Header Stacking Context */}
                    <div className="fixed top-16 right-4 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-fade-in-up origin-top-right">
                        <button 
                            onClick={handleEndChat} 
                            className="w-full text-left px-4 py-3 hover:bg-red-50 text-sm text-gray-700 font-medium border-b border-gray-50 flex items-center gap-2"
                        >
                            <Icons.LogOut className="w-4 h-4" /> End Chat
                        </button>
                        <button onClick={handleReport} className="w-full text-left px-4 py-3 hover:bg-yellow-50 text-sm text-yellow-600 font-medium">Report User</button>
                        <button onClick={handleBlock} className="w-full text-left px-4 py-3 hover:bg-red-50 text-sm text-red-600 font-medium">Block User</button>
                    </div>
                    </>
                )}
            </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-2 text-center text-xs text-yellow-700 mb-4 flex items-center justify-center gap-1">
            <span>🔥 Ephemeral Mode: Messages delete after 2 mins.</span>
        </div>

        {messages.length === 0 && (
            <div className="text-center mt-8 animate-fade-in-up">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                    <Icons.Message className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="font-bold text-gray-800 mb-1 text-lg">It's a Match!</h3>
                <p className="text-sm text-gray-500 mb-8 max-w-xs mx-auto">
                    Say something nice. Pick an icebreaker below:
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto">
                    {randomIcebreakers.map((txt, i) => (
                        <button 
                            key={i} 
                            onClick={() => setInputText(txt)} 
                            className="bg-white border border-gray-200 px-4 py-2 rounded-full text-xs font-medium text-gray-600 hover:border-nepaliBlue hover:text-nepaliBlue hover:bg-blue-50 transition-all shadow-sm active:scale-95"
                        >
                            {txt}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {messages.map((msg, index) => {
            const isMe = msg.fromUserId === currentUser.id;
            const isSystem = msg.isSystem;
            const prevMsg = messages[index - 1];
            const showAvatar = !isMe && (!prevMsg || prevMsg.fromUserId !== msg.fromUserId);

            if (isSystem) {
                return (
                    <div key={msg.id} className="text-center my-6">
                        <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full tracking-wider shadow-sm">
                            {msg.text}
                        </span>
                    </div>
                );
            }

            return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2 group`}>
                    {!isMe && (
                        <div className="w-8 h-8 flex-shrink-0 mb-1">
                            {showAvatar ? (
                                <img src={matchData.partner.photoUrl || ''} className="w-8 h-8 rounded-full bg-gray-200 object-cover border border-gray-100" />
                            ) : <div className="w-8" />}
                        </div>
                    )}
                    
                    <div 
                        className={`
                            max-w-[75%] px-4 py-2.5 text-sm shadow-sm relative leading-relaxed
                            ${isMe 
                                ? 'bg-gradient-to-br from-nepaliRed to-pink-600 text-white rounded-2xl rounded-tr-sm shadow-red-500/10' 
                                : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-sm shadow-gray-200/50'
                            }
                        `}
                    >
                        {msg.text}
                        {/* Timestamp */}
                        <div className={`absolute bottom-0 -mb-5 text-[10px] text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isMe ? 'right-0' : 'left-0'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                </div>
            );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white px-3 py-3 border-t border-gray-100 flex gap-2 items-center safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-10">
        <input 
            type="text"
            className="flex-1 bg-gray-50 rounded-full px-5 py-3 outline-none focus:ring-2 focus:ring-nepaliRed/10 focus:bg-white border border-transparent focus:border-nepaliRed/20 transition-all text-sm placeholder-gray-400"
            placeholder="Type a message..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button 
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="bg-nepaliRed text-white p-3 rounded-full hover:bg-red-600 disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400 transition-all shadow-md flex-shrink-0 active:scale-95 transform hover:shadow-lg"
        >
            <Icons.Send className="w-5 h-5 ml-0.5" />
        </button>
      </div>
    </div>
  );
};
