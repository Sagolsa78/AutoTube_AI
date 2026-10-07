import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';

export default function CopilotPanel({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "I'm your creative copilot. What are we making today?" }
  ]);
  const [inputValue, setInputValue] = useState('');
  const script = useStudioStore(s => s.script);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Add user message
    const newMsg = { role: 'user', text: inputValue };
    setMessages(prev => [...prev, newMsg]);
    setInputValue('');

    // Mock AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `I've analyzed your prompt. Would you like me to rewrite the hook for better retention on TikTok?`,
        actions: ['Rewrite Hook', 'Make it funnier']
      }]);
    }, 1000);
  };

  return (
    <div className="w-80 border-l border-border bg-canvas flex flex-col shadow-2xl relative z-40 animate-in slide-in-from-right">

      {/* Header */}
      <div className="h-14 border-b border-border/50 flex items-center justify-between px-4 shrink-0 bg-surface">
        <div className="flex items-center gap-2">
          <Icon name="sparkles" size={16} className="text-brand-red" />
          <span className="text-xs font-bold text-text-primary tracking-wide">AI Copilot</span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-surface-hover transition-colors">
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
        {/* Context Chip */}
        <div className="flex justify-center">
          <div className="bg-surface border border-border/50 px-3 py-1 rounded-full text-[10px] font-medium text-text-muted flex items-center gap-1.5">
            <Icon name="file-text" size={10} />
            Context: {script?.title || 'Untitled Draft'}
          </div>
        </div>

        {/* Messages */}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-text-primary text-canvas rounded-br-sm'
                : 'bg-surface border border-border/50 text-text-primary rounded-bl-sm'
            }`}>
              {msg.text}
            </div>

            {/* Suggested Actions */}
            {msg.actions && (
              <div className="flex flex-wrap gap-2 mt-2 ml-1">
                {msg.actions.map((action, aIdx) => (
                  <button key={aIdx} className="px-3 py-1.5 bg-surface-hover border border-border rounded-lg text-[10px] font-bold text-text-secondary hover:text-brand-red hover:border-brand-red/50 transition-colors">
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border/50 bg-surface">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Ask AI to write, edit, or fix..."
            className="w-full bg-canvas border border-border rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-brand-red transition-colors placeholder:text-text-muted"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="absolute right-2 p-1.5 rounded-lg text-brand-red hover:bg-brand-red/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Icon name="arrow-up" size={16} />
          </button>
        </form>
        <p className="text-[9px] text-center text-text-muted mt-2 font-medium">Copilot uses AI and may make mistakes.</p>
      </div>

    </div>
  );
}
