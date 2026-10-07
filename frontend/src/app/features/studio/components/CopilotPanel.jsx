import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../../components/Icon';
import useStudioStore from '../../../../store/studioStore';
import { api } from '../../../../services/api';
import { toast } from 'sonner';

export default function CopilotPanel({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "I'm your creative copilot. I can help improve your content." }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { currentStep, project, script, setProject, setScript, editingScenes, setEditingScenes, updateUiState } = useStudioStore();
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  // Context-aware suggested actions
  const getSuggestedActions = () => {
    switch (currentStep) {
      case 'brief': return [{ label: 'Improve Idea', action: handleImproveIdea }];
      case 'script': return [{ label: 'Regenerate Script', action: handleRegenerateScript }];
      case 'storyboard': return [{ label: 'Generate Visuals', action: handleGenerateVisuals }];
      default: return [];
    }
  };

  const handleImproveIdea = async () => {
    if (!project) return;
    setIsProcessing(true);
    addMessage('user', 'Improve my idea');
    try {
      const improved = await api.improveIdea(project.topic, project.channel_id);
      setProject({ ...project, title: improved.title, topic: improved.topic });
      addMessage('assistant', 'I have improved your idea and updated the brief.');
      toast.success("Idea improved!");
    } catch (err) {
      addMessage('assistant', 'Sorry, I failed to improve the idea.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegenerateScript = async () => {
    if (!project || !script) return;
    setIsProcessing(true);
    addMessage('user', 'Regenerate the script');
    try {
      const newScript = await api.regenerateScript(script.id);
      setScript(newScript);
      setEditingScenes(newScript.scenes || []);
      addMessage('assistant', 'I have generated a new script version.');
      toast.success("Script regenerated!");
    } catch (err) {
      addMessage('assistant', 'Sorry, I failed to regenerate the script.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateVisuals = async () => {
    if (!script || !editingScenes || editingScenes.length === 0) return;
    setIsProcessing(true);
    addMessage('user', 'Generate visuals for scenes');
    try {
      // Just regenerate the first scene as an example action
      const firstScene = editingScenes[0];
      if (api.generateAsset) {
         const asset = await api.generateAsset(script.id, firstScene.scene_number, firstScene.visual_prompt);
         const newScenes = [...editingScenes];
         newScenes[0].asset_id = asset.id;
         newScenes[0].image_url = asset.thumbnail_url || asset.url;
         setEditingScenes(newScenes);
         addMessage('assistant', 'I have generated a new visual for Scene 1.');
         toast.success("Visual generated!");
      } else {
         throw new Error("Asset API not available");
      }
    } catch (err) {
      addMessage('assistant', 'Sorry, I failed to generate visuals.');
    } finally {
      setIsProcessing(false);
    }
  };

  const addMessage = (role, text) => {
    setMessages(prev => [...prev, { role, text }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue;
    addMessage('user', userText);
    setInputValue('');
    setIsProcessing(true);

    // If we have a generic AI endpoint we could call it here.
    // For now, fall back to default behavior.
    try {
       // A generic fallback if no specific intent matched
       addMessage('assistant', `I understand you want to: "${userText}". Try using the suggested actions above for specific modifications.`);
    } finally {
       setIsProcessing(false);
    }
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
          <div className="bg-surface border border-border/50 px-3 py-1 rounded-full text-[10px] font-medium text-text-muted flex items-center gap-1.5 capitalize">
            <Icon name="file-text" size={10} />
            Context: {currentStep} Phase
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
          </div>
        ))}
        {isProcessing && (
           <div className="flex flex-col items-start">
             <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-surface border border-border/50 rounded-bl-sm">
                <span className="flex items-center gap-1">
                   <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-bounce" />
                   <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-bounce" style={{ animationDelay: '0.2s' }} />
                   <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-bounce" style={{ animationDelay: '0.4s' }} />
                </span>
             </div>
           </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Context Actions */}
      {getSuggestedActions().length > 0 && !isProcessing && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {getSuggestedActions().map((actionObj, idx) => (
            <button
              key={idx}
              onClick={actionObj.action}
              className="px-3 py-1.5 bg-surface border border-border rounded-lg text-[10px] font-bold text-text-secondary hover:text-brand-red hover:border-brand-red/50 transition-colors"
            >
              {actionObj.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-border/50 bg-surface shrink-0">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            disabled={isProcessing}
            placeholder="Ask AI to write, edit, or fix..."
            className="w-full bg-canvas border border-border rounded-xl pl-4 pr-10 py-2.5 text-xs text-text-primary focus:outline-none focus:border-brand-red transition-colors placeholder:text-text-muted disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
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
