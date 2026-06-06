import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, Sparkles, Loader2 } from 'lucide-react';
import api from '../api/axios';

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Hello! I am your AI Queue Assistant. I have live access to your active tokens, counter statuses, and service wait times. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessageText = input.trim();
    setInput('');
    
    // Add user message to state
    const userMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: userMessageText,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await api.post('/chatbot/message', { message: userMessageText });
      
      const botReply = response.data?.data?.response || "I'm sorry, I encountered an issue processing that request. Please try again.";
      
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-bot`,
          sender: 'bot',
          text: botReply,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error('Chatbot request error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-bot-error`,
          sender: 'bot',
          text: "Sorry, I'm having trouble connecting right now. Please verify your connection and try again.",
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans pointer-events-auto">
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:scale-110 hover:shadow-indigo-500/40 active:scale-95 cursor-pointer"
          aria-label="Open Chatbot"
        >
          <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 opacity-0 blur transition duration-300 group-hover:opacity-60"></div>
          <div className="relative flex h-full w-full items-center justify-center rounded-full bg-slate-950">
            <MessageSquare className="h-6 w-6 text-indigo-400 transition-transform group-hover:rotate-6" />
            <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-pink-400 animate-pulse" />
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300">
          
          {/* Header */}
          <div className="relative flex items-center justify-between border-b border-slate-800/80 bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Bot className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                  Queue Assistant
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </h3>
                <span className="text-[10px] text-indigo-300 font-medium">Powered by Gemini AI</span>
              </div>
            </div>
            
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender !== 'user' && (
                  <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20">
                    <Bot className="h-4 w-4 text-indigo-400" />
                  </div>
                )}
                
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-tr-none shadow-md shadow-indigo-600/10'
                      : msg.isError
                      ? 'bg-red-500/10 border border-red-500/20 text-red-200 rounded-tl-none'
                      : 'bg-slate-900/60 border border-slate-800/50 text-slate-200 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <span className="mt-1 block text-[9px] text-right text-slate-400/80">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Loading / Typing Indicator */}
            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  <Bot className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="bg-slate-900/60 border border-slate-800/50 text-slate-400 rounded-2xl rounded-tl-none px-4 py-3 text-sm flex items-center gap-2">
                  <Loader2 className="h-4.5 w-4.5 animate-spin text-indigo-400" />
                  <span>Analyzing queue status...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="border-t border-slate-800/80 bg-slate-950/80 p-3 flex gap-2 items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about waiting times, counters..."
              disabled={isLoading}
              className="flex-1 bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-indigo-600 cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatBot;
