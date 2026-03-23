'use client';

import { useEffect, useState, useRef } from 'react';
import { useCronogramaStore } from '@/store/cronogramaStore';

export default function DataInitializer({ children }: { children: React.ReactNode }) {
  const store = useCronogramaStore();
  const hasHydrated = useCronogramaStore((state) => state._hasHydrated);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    // Aguardar hidratação do Zustand antes de inicializar
    if (!hasHydrated) {
      console.log('⏳ Aguardando hidratação do Zustand...');
      return;
    }

    // Prevenir múltiplas inicializações
    if (initRef.current) {
      return;
    }

    initRef.current = true;

    async function initializeData() {
      try {
        console.log('🔄 Inicializando sistema...');
        
        // Verificar se já temos dados no localStorage após hidratação
        const localData = store.data;
        
        if (localData && localData.projects) {
          console.log('✓ Dados encontrados no localStorage');
          setLoading(false);
          return;
        }
        
        // Se não há dados locais, carregar do servidor
        console.log('📡 Carregando dados do servidor...');
        const savedResponse = await fetch('/api/cronograma', {
          cache: 'no-store',
        });
        
        if (!savedResponse.ok) {
          throw new Error('Erro ao comunicar com o servidor');
        }

        const savedDataResponse = await savedResponse.json();
        
        if (savedDataResponse && savedDataResponse.data) {
          console.log('✓ Dados carregados do servidor');
          store.setData(savedDataResponse.data);
          setLoading(false);
          return;
        }

        throw new Error('Nenhum dado disponível no servidor');
        
      } catch (err) {
        console.error('✗ Erro ao inicializar dados:', err);
        setError('Erro ao carregar dados. Tente recarregar a página.');
        initRef.current = false; // Permitir retry
        setLoading(false);
      }
    }

    initializeData();
  }, [hasHydrated, store]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-sm font-medium text-muted-foreground">Carregando cronograma...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center max-w-sm">
          <p className="text-sm text-destructive mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Recarregar
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="px-4 py-2 text-xs bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
            >
              Limpar Cache
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
