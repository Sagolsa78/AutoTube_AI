import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const ChannelContext = createContext();

export function useChannel() {
  return useContext(ChannelContext);
}

export function ChannelProvider({ children }) {
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(() => {
    return localStorage.getItem('autotube_active_channel') || null;
  });
  const [loadingChannels, setLoadingChannels] = useState(true);

  async function loadChannels() {
    try {
      const data = await api.getChannels();
      setChannels(data || []);
      
      if (data && data.length > 0) {
        // If we don't have an active channel, or the active channel is not in the list, set it to the first one
        if (!activeChannelId || !data.find(c => c.id === activeChannelId)) {
          setActiveChannelId(data[0].id);
        }
      } else {
          setActiveChannelId(null);
      }
    } catch (e) {
      console.error("Failed to load channels", e);
    } finally {
      setLoadingChannels(false);
    }
  }

  useEffect(() => {
    loadChannels();
  }, []);

  const handleSetActiveChannel = (id) => {
    setActiveChannelId(id);
    if (id) {
        localStorage.setItem('autotube_active_channel', id);
    } else {
        localStorage.removeItem('autotube_active_channel');
    }
  };

  const activeChannel = channels.find(c => c.id === activeChannelId) || null;

  return (
    <ChannelContext.Provider value={{
        channels,
        activeChannel,
        activeChannelId,
        setActiveChannelId: handleSetActiveChannel,
        loadingChannels,
        refreshChannels: loadChannels
    }}>
      {children}
    </ChannelContext.Provider>
  );
}
