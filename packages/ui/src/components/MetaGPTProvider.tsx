import React, { createContext, useContext, useState, useEffect } from 'react';

interface MetaGPTConfig {
  apiKey?: string;
  endpoint?: string;
  debug?: boolean;
  offlineMode?: boolean;
}

interface MetaGPTContextType {
  config: MetaGPTConfig;
  setConfig: (config: Partial<MetaGPTConfig>) => void;
  isInitialized: boolean;
  isOffline: boolean;
}

const MetaGPTContext = createContext<MetaGPTContextType | null>(null);

export const useMetaGPT = () => {
  const context = useContext(MetaGPTContext);
  if (!context) {
    throw new Error('useMetaGPT must be used within a MetaGPTProvider');
  }
  return context;
};

interface MetaGPTProviderProps {
  children: React.ReactNode;
  initialConfig?: MetaGPTConfig;
}

export const MetaGPTProvider: React.FC<MetaGPTProviderProps> = ({ 
  children, 
  initialConfig = {} 
}) => {
  const [config, setConfigState] = useState<MetaGPTConfig>({
    debug: false,
    offlineMode: false,
    ...initialConfig,
  });

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeMetaGPT = async () => {
      try {
        // 初始化逻辑，例如验证 API 密钥，检查连接等
        await new Promise(resolve => setTimeout(resolve, 100));
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize MetaGPT:', error);
        setConfigState(prev => ({ ...prev, offlineMode: true }));
      }
    };

    initializeMetaGPT();
  }, []);

  const setConfig = (newConfig: Partial<MetaGPTConfig>) => {
    setConfigState(prev => ({ ...prev, ...newConfig }));
  };

  const value: MetaGPTContextType = {
    config,
    setConfig,
    isInitialized,
    isOffline: Boolean(config.offlineMode),
  };

  return (
    <MetaGPTContext.Provider value={value}>
      {children}
    </MetaGPTContext.Provider>
  );
};

export default MetaGPTProvider; 