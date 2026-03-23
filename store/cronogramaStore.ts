import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CronogramaState, TimelineData, Project, Feature } from '@/types/cronograma';

export const useCronogramaStore = create<CronogramaState>()(
  persist(
    (set, get) => ({
      data: null,
      _hasHydrated: false,
      
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },
      
      setData: (data: TimelineData) => {
        set({ data });
        // Salvar no servidor de forma assíncrona
        if (typeof window !== 'undefined') {
          fetch('/api/cronograma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          .then(() => console.log('✓ Dados salvos no servidor'))
          .catch((err) => console.error('✗ Erro ao salvar no servidor:', err));
        }
      },
      
      addProject: (project: Project) => {
        set((state) => ({
          data: state.data
            ? { ...state.data, projects: [...state.data.projects, project] }
            : null,
        }));
        const newData = get().data;
        if (newData) get().setData(newData);
      },
      
      updateProject: (id: string, updates: Partial<Project>) => {
        set((state) => ({
          data: state.data
            ? {
                ...state.data,
                projects: state.data.projects.map((p) =>
                  p.id === id ? { ...p, ...updates } : p
                ),
              }
            : null,
        }));
        const newData = get().data;
        if (newData) get().setData(newData);
      },
      
      deleteProject: (id: string) => {
        set((state) => ({
          data: state.data
            ? {
                ...state.data,
                projects: state.data.projects.filter((p) => p.id !== id),
              }
            : null,
        }));
        const newData = get().data;
        if (newData) get().setData(newData);
      },
      
      addFeature: (projectId: string, phaseId: string, feature: Feature) => {
        set((state) => ({
          data: state.data
            ? {
                ...state.data,
                projects: state.data.projects.map((project) =>
                  project.id === projectId
                    ? {
                        ...project,
                        phases: project.phases.map((phase) =>
                          phase.id === phaseId
                            ? { ...phase, features: [...phase.features, feature] }
                            : phase
                        ),
                      }
                    : project
                ),
              }
            : null,
        }));
        const newData = get().data;
        if (newData) get().setData(newData);
      },
      
      updateFeature: (projectId: string, phaseId: string, featureId: string, updates: Partial<Feature>) => {
        set((state) => ({
          data: state.data
            ? {
                ...state.data,
                projects: state.data.projects.map((project) =>
                  project.id === projectId
                    ? {
                        ...project,
                        phases: project.phases.map((phase) =>
                          phase.id === phaseId
                            ? {
                                ...phase,
                                features: phase.features.map((feature) =>
                                  feature.id === featureId
                                    ? { ...feature, ...updates }
                                    : feature
                                ),
                              }
                            : phase
                        ),
                      }
                    : project
                ),
              }
            : null,
        }));
        const newData = get().data;
        if (newData) get().setData(newData);
      },
      
      deleteFeature: (projectId: string, phaseId: string, featureId: string) => {
        set((state) => ({
          data: state.data
            ? {
                ...state.data,
                projects: state.data.projects.map((project) =>
                  project.id === projectId
                    ? {
                        ...project,
                        phases: project.phases.map((phase) =>
                          phase.id === phaseId
                            ? {
                                ...phase,
                                features: phase.features.filter((f) => f.id !== featureId),
                              }
                            : phase
                        ),
                      }
                    : project
                ),
              }
            : null,
        }));
        const newData = get().data;
        if (newData) get().setData(newData);
      },
    }),
    {
      name: 'cronograma-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({ data: state.data }),
      // Aumentar threshold de storage e adicionar tratamento de erro
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Migração futura se necessário
        return persistedState as CronogramaState;
      },
    }
  )
);

// Adicionar listener para erros de quota
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e.message?.includes('QuotaExceededError') || 
        e.message?.includes('exceeded the quota')) {
      console.error('LocalStorage cheio! Limpando dados antigos...');
      try {
        // Limpar caches do GitHub que podem estar no localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('github-')) {
            localStorage.removeItem(key);
          }
        });
      } catch (err) {
        console.error('Erro ao limpar storage:', err);
      }
    }
  });
}
