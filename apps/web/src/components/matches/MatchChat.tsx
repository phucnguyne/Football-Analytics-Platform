'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function MatchChat({ isLive }: { isLive: boolean }) {
  const [messages, setMessages] = useState([
    { id: 1, user: 'Gooner99', text: 'Come on!! We need a goal.', time: '2m ago', role: 'user' },
    { id: 2, user: 'BlueIsColor', text: 'Defending looks solid today.', time: '1m ago', role: 'user' },
    { id: 3, user: 'FA_Bot', text: 'Welcome to the live chat! Keep it respectful.', time: 'Just now', role: 'system' }
  ]);
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages])

  if (!isLive) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, {
      id: Date.now(),
      user: 'You',
      text: input,
      time: 'Just now',
      role: 'user'
    }]);
    setInput('');
  }

  return (
    <div className="bg-card rounded-2xl border flex flex-col h-[400px]">
      <div className="p-4 border-b bg-muted/20 flex justify-between items-center rounded-t-2xl">
        <h3 className="font-bold flex items-center gap-2">
          <span>💬</span> Live Chat
        </h3>
        <span className="text-xs flex items-center gap-1 text-green-500 font-semibold bg-green-500/10 px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          241 online
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={cn("flex flex-col", msg.role === 'system' ? "items-center text-center" : "")}>
            {msg.role === 'system' ? (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                {msg.text}
              </span>
            ) : (
              <div className="text-sm">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={cn("font-bold text-xs", msg.user === 'You' ? 'text-primary' : 'text-muted-foreground')}>
                    {msg.user}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">{msg.time}</span>
                </div>
                <div className={cn("p-2.5 rounded-xl break-words", msg.user === 'You' ? "bg-primary/10 text-foreground" : "bg-muted/40")}>
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t bg-background rounded-b-2xl">
        <form onSubmit={handleSend} className="flex gap-2">
          <input 
            type="text" 
            placeholder="Say something..." 
            className="flex-1 bg-muted/50 border-none rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button 
            type="submit" 
            className="bg-primary text-primary-foreground p-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            disabled={!input.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

