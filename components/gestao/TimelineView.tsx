'use client';

import { useState, useRef, useEffect } from 'react';
import { useCronogramaStore } from '@/store/cronogramaStore';
import { MONTHS, WeekAssignment, CATEGORIES, PEOPLE } from '@/types/cronograma';
import { Lock, LockOpen, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function TimelineView() {
  const data = useCronogramaStore((state) => state.data);
  const updateFeature = useCronogramaStore((state) => state.updateFeature);
  const setData = useCronogramaStore((state) => state.setData);
  const [isLocked, setIsLocked] = useState(true);
  const [editingFeature, setEditingFeature] = useState<string | null>(null);
  const [featureName, setFeatureName] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  
  // Estados para drag-to-scroll
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  // Estados para edição de tags
  const [editingModal, setEditingModal] = useState<{
    projectId: string;
    phaseId: string;
    featureId: string;
    month: string;
    weekNum: number;
    currentAssignment: WeekAssignment | undefined;
    currentWeeks: WeekAssignment[];
  } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof CATEGORIES | ''>('');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  // Verificar se pode rolar para esquerda/direita
  const checkScrollPosition = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollPosition();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
      window.addEventListener('resize', checkScrollPosition);
      return () => {
        container.removeEventListener('scroll', checkScrollPosition);
        window.removeEventListener('resize', checkScrollPosition);
      };
    }
  }, [data]);

  // Inicializar features expandidas (abertas se tem alocação, fechadas se não tem)
  useEffect(() => {
    if (data) {
      const initialExpanded = new Set<string>();
      data.projects.forEach(project => {
        project.phases.forEach(phase => {
          phase.features.forEach(feature => {
            // Features COM weeks ficam abertas por padrão
            if (feature.weeks.length > 0) {
              initialExpanded.add(feature.id);
            }
          });
        });
      });
      setExpandedFeatures(initialExpanded);
    }
  }, [data]);

  // Drag-to-scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
    scrollContainerRef.current.style.cursor = 'grabbing';
    scrollContainerRef.current.style.userSelect = 'none';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // multiplicador para velocidade
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grab';
      scrollContainerRef.current.style.userSelect = 'auto';
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 640; // 8 semanas * 80px
      const targetScroll = scrollContainerRef.current.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount);
      scrollContainerRef.current.scrollTo({
        left: targetScroll,
        behavior: 'smooth',
      });
    }
  };

  const scrollToMonth = (monthIndex: number) => {
    if (scrollContainerRef.current && data) {
      let scrollPosition = 264; // largura inicial da coluna de nomes
      for (let i = 0; i < monthIndex; i++) {
        scrollPosition += data.months[i].weeks * 80;
      }
      scrollContainerRef.current.scrollTo({
        left: scrollPosition - 264,
        behavior: 'smooth',
      });
    }
  };

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg">Nenhum cronograma carregado.</p>
        <p className="text-sm mt-2">Importe um arquivo CSV para começar.</p>
      </div>
    );
  }

  const getCategoryColor = (category?: keyof typeof CATEGORIES): string => {
    if (!category) return 'bg-gray-500';
    return CATEGORIES[category].color;
  };

  const togglePerson = (person: string) => {
    setSelectedPeople(prev =>
      prev.includes(person) ? prev.filter(p => p !== person) : [...prev, person]
    );
  };

  const toggleFeature = (featureId: string) => {
    setExpandedFeatures(prev => {
      const newSet = new Set(prev);
      if (newSet.has(featureId)) {
        newSet.delete(featureId);
      } else {
        newSet.add(featureId);
      }
      return newSet;
    });
  };

  const handleReloadFromServer = async () => {
    if (!confirm('Recarregar dados do servidor? Isso substituirá as alterações locais não salvas.')) {
      return;
    }
    
    try {
      // Limpar localStorage
      localStorage.removeItem('cronograma-storage');
      
      // Buscar dados do servidor
      const response = await fetch('/api/cronograma', { cache: 'no-store' });
      const result = await response.json();
      
      if (result && result.data) {
        setData(result.data);
        alert('✓ Dados recarregados do servidor com sucesso!');
        window.location.reload();
      }
    } catch (error) {
      console.error('Erro ao recarregar:', error);
      alert('✗ Erro ao recarregar dados do servidor');
    }
  };

  const handleCellClickNew = (
    projectId: string,
    phaseId: string,
    featureId: string,
    month: string,
    weekNum: number,
    currentAssignment: WeekAssignment | undefined,
    currentWeeks: WeekAssignment[]
  ) => {
    if (isLocked) return;
    
    // Abrir modal de edição
    setEditingModal({
      projectId,
      phaseId,
      featureId,
      month,
      weekNum,
      currentAssignment,
      currentWeeks,
    });
    
    // Preencher com valores atuais se existir
    if (currentAssignment) {
      setSelectedCategory(currentAssignment.category || '');
      setSelectedPeople(currentAssignment.people || []);
    } else {
      setSelectedCategory('');
      setSelectedPeople([]);
    }
  };

  const handleSaveAssignment = () => {
    if (!editingModal) return;

    const { projectId, phaseId, featureId, month, weekNum, currentWeeks } = editingModal;
    const updatedWeeks = [...currentWeeks];
    const existingIndex = updatedWeeks.findIndex(
      (w) => w.month === month && w.weekNumber === weekNum + 1
    );

    if (selectedCategory === '' && selectedPeople.length === 0) {
      // Remover atribuição
      if (existingIndex !== -1) {
        updatedWeeks.splice(existingIndex, 1);
      }
    } else {
      // Adicionar ou atualizar
      const newAssignment: WeekAssignment = {
        month,
        weekNumber: weekNum + 1,
        responsible: selectedCategory || 'outros',
        category: selectedCategory || undefined,
        people: selectedPeople.length > 0 ? selectedPeople : undefined,
        status: 'planned',
      };

      if (existingIndex !== -1) {
        updatedWeeks[existingIndex] = newAssignment;
      } else {
        updatedWeeks.push(newAssignment);
      }
    }

    updateFeature(projectId, phaseId, featureId, { weeks: updatedWeeks });
    setEditingModal(null);
    setSelectedCategory('');
    setSelectedPeople([]);
  };

  // Cores de fundo alternadas por mês
  const getMonthBackgroundColor = (monthIndex: number): string => {
    const colors = [
      'bg-blue-100/60 dark:bg-blue-900/20',
      'bg-purple-100/60 dark:bg-purple-900/20',
      'bg-green-100/60 dark:bg-green-900/20',
      'bg-yellow-100/60 dark:bg-yellow-900/20',
      'bg-pink-100/60 dark:bg-pink-900/20',
      'bg-indigo-100/60 dark:bg-indigo-900/20',
      'bg-orange-100/60 dark:bg-orange-900/20',
      'bg-teal-100/60 dark:bg-teal-900/20',
      'bg-red-100/60 dark:bg-red-900/20',
      'bg-cyan-100/60 dark:bg-cyan-900/20',
      'bg-lime-100/60 dark:bg-lime-900/20',
    ];
    return colors[monthIndex % colors.length];
  };

  const handleCellClick = (
    projectId: string,
    phaseId: string,
    featureId: string,
    month: string,
    weekNum: number,
    currentAssignment: WeekAssignment | undefined,
    currentWeeks: WeekAssignment[]
  ) => {
    handleCellClickNew(projectId, phaseId, featureId, month, weekNum, currentAssignment, currentWeeks);
  };



  const handleFeatureNameClick = (featureId: string, currentName: string) => {
    if (isLocked) return;
    setEditingFeature(featureId);
    setFeatureName(currentName);
  };

  const handleFeatureNameSave = (projectId: string, phaseId: string, featureId: string) => {
    if (featureName.trim()) {
      updateFeature(projectId, phaseId, featureId, { name: featureName.trim() });
    }
    setEditingFeature(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header com botão de cadeado e navegação */}
      <div className="flex justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-4 flex-1">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Cronograma de Execução
          </h2>
          
          {/* Navegação rápida por mês */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Ir para:</span>
            <div className="flex gap-1 flex-wrap">
              {data?.months.map((month, idx) => (
                <button
                  key={month.name}
                  onClick={() => scrollToMonth(idx)}
                  className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  title={`Ir para ${month.name}`}
                >
                  {month.name.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReloadFromServer}
            className="px-2 py-1 text-xs font-medium rounded bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center gap-1"
            title="Recarregar dados do servidor (limpa cache local)"
          >
            🔄
          </button>
          
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              isLocked
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            title={isLocked ? 'Clique para desbloquear edição' : 'Clique para bloquear edição'}
          >
            {isLocked ? <Lock size={14} /> : <LockOpen size={14} />}
          </button>
        </div>
      </div>

      {/* Navegação lateral com controles de scroll */}
      <div className="flex justify-between items-center mb-4">
        <div></div>
        {/* Controles de scroll */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`p-2 rounded-lg transition-all ${
              canScrollLeft
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
            title="Rolar para esquerda"
          >
            <ChevronLeft size={20} />
          </button>
          
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`p-2 rounded-lg transition-all ${
              canScrollRight
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
            title="Rolar para direita"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {!isLocked && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Modo de edição ativo:</strong> Clique no nome de uma feature para editar.
            Clique em uma célula de semana para definir ou alterar o responsável.
          </p>
        </div>
      )}

      {/* Container com scroll horizontal melhorado */}
      <div 
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-visible scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-200 dark:scrollbar-track-gray-800 relative"
        style={{ 
          scrollbarWidth: 'thin',
          scrollbarGutter: 'stable',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
      <div className="min-w-max">
        {/* Header com meses */}
        <div className="flex border-b-2 border-gray-300 dark:border-gray-600 mb-4 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="w-64 flex-shrink-0 font-bold text-sm text-gray-900 dark:text-gray-100 px-2 py-2">Projeto / Fase / Feature</div>
          {data.months.map((month, idx) => (
            <div 
              key={idx} 
              className={`flex-shrink-0 ${idx < data.months.length - 1 ? 'border-r-2 border-gray-300 dark:border-gray-600' : ''} ${getMonthBackgroundColor(idx)}`} 
              style={{ width: `${month.weeks * 80}px` }}
            >
              <div className="font-bold text-center text-sm py-2">
                <span className="text-gray-800 dark:text-gray-200">{month.name}</span>
              </div>
              <div className="flex">
                {Array.from({ length: month.weeks }, (_, i) => (
                  <div
                    key={i}
                    className="text-center text-xs text-gray-500 dark:text-gray-400 py-1 flex items-center justify-center"
                    style={{ width: '80px', flex: '0 0 80px' }}
                  >
                    S{i + 1}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Projetos */}
        {data.projects.map((project) => (
          <div key={project.id} className="mb-6">
            <div className="font-bold text-lg text-blue-900 dark:text-blue-300 mb-2 border-l-4 border-blue-600 dark:border-blue-400 pl-2">{project.name}</div>
            {project.phases.map((phase) => (
              <div key={phase.id} className="mb-4">
                <div className="font-semibold text-md text-gray-700 dark:text-gray-300 mb-2 ml-6 flex items-center gap-2">
                  <span className="text-gray-400 dark:text-gray-500">›</span>
                  {phase.name}
                </div>
                {phase.features.map((feature) => {
                  const isExpanded = expandedFeatures.has(feature.id);
                  return (
                    <div key={feature.id} className="mb-2">
                      <div
                        className={`flex items-start rounded ${
                          !isLocked ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''
                        }`}
                      >
                        {/* Nome da Feature com Toggle */}
                        <div className="w-64 flex-shrink-0 py-2 px-3 ml-8">
                          {editingFeature === feature.id ? (
                            <input
                              type="text"
                              value={featureName}
                              onChange={(e) => setFeatureName(e.target.value)}
                              onBlur={() => handleFeatureNameSave(project.id, phase.id, feature.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleFeatureNameSave(project.id, phase.id, feature.id);
                                } else if (e.key === 'Escape') {
                                  setEditingFeature(null);
                                }
                              }}
                              autoFocus
                              className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200"
                            />
                          ) : (
                            <div>
                              <div className="flex items-start gap-2 group">
                                {/* Botão Toggle */}
                                <button
                                  onClick={() => toggleFeature(feature.id)}
                                  className="flex-shrink-0 mt-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-transform"
                                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                
                                {/* Nome e Descrição */}
                                <div 
                                  onClick={() => handleFeatureNameClick(feature.id, feature.name)}
                                  className={`flex-1 ${!isLocked ? 'cursor-pointer' : ''}`}
                                >
                                  <div className={`text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight ${
                                    !isLocked ? 'group-hover:text-blue-600 dark:group-hover:text-blue-400' : ''
                                  }`}>
                                    {feature.name}
                                  </div>
                                  {feature.description && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                      {feature.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Timeline - só mostra se expandido */}
                        {isExpanded && (
                          <div className="flex">
                            {data.months.map((month, monthIdx) => (
                        <div
                          key={month.name}
                          className={`${monthIdx < data.months.length - 1 ? 'border-r-2 border-gray-300 dark:border-gray-600' : ''} ${getMonthBackgroundColor(monthIdx)}`}
                          style={{ width: `${month.weeks * 80}px`, display: 'flex', flexShrink: 0 }}
                        >
                          {Array.from({ length: month.weeks }, (_, weekNum) => {
                            const assignment = feature.weeks.find(
                              (w) => w.month === month.name && w.weekNumber === weekNum + 1
                            );
                            const cellKey = `${feature.id}-${month.name}-${weekNum}`;

                            return (
                              <div
                                key={weekNum}
                                className="py-1 relative flex items-center justify-center"
                                style={{ width: '80px', flex: '0 0 80px' }}
                              >
                                <div
                                  onClick={() =>
                                    handleCellClick(
                                      project.id,
                                      phase.id,
                                      feature.id,
                                      month.name,
                                      weekNum,
                                      assignment,
                                      feature.weeks
                                    )
                                  }
                                  className={`w-full h-full mx-1 ${
                                    assignment
                                      ? `${getCategoryColor(assignment.category)} 
                                         text-white text-xs rounded shadow-sm p-1
                                         ${!isLocked ? 'hover:shadow-md hover:scale-105 transition-all cursor-pointer' : ''}`
                                      : !isLocked
                                      ? 'border border-dashed border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 flex items-center justify-center'
                                      : ''
                                  }`}
                                  title={
                                    assignment
                                      ? `${assignment.category ? CATEGORIES[assignment.category].label : assignment.responsible} - ${month.name} S${weekNum + 1}`
                                      : !isLocked
                                      ? 'Clique para atribuir'
                                      : ''
                                  }
                                >
                                  {assignment ? (
                                    <div className="flex flex-col gap-1 items-center justify-center h-full">
                                      {assignment.category && (
                                        <div className="text-[10px] font-semibold text-white leading-tight text-center px-1">
                                          {CATEGORIES[assignment.category].label}
                                        </div>
                                      )}
                                      {assignment.people && assignment.people.length > 0 && (
                                        <div className="flex gap-0.5 flex-wrap justify-center">
                                          {assignment.people.map((person) => {
                                            const personData = PEOPLE[person as keyof typeof PEOPLE];
                                            return personData ? (
                                              <div
                                                key={person}
                                                className={`${personData.color} w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white`}
                                                title={personData.name}
                                              >
                                                {personData.initials}
                                              </div>
                                            ) : null;
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ) : !isLocked ? (
                                    <span className="text-gray-400 text-xs">+</span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-2 text-sm text-gray-900 dark:text-gray-100">Legenda:</h3>
        
        <div className="mb-4">
          <h4 className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-400">Categorias:</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`${cat.color} w-4 h-4 rounded`}></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{cat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-400">Pessoas:</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(PEOPLE).map(([key, person]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`${person.color} w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white`}>
                  {person.initials}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{person.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Atribuir Tarefa
              </h3>
              <button
                onClick={() => setEditingModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Categoria
              </label>
              <div className="flex flex-col gap-2">
                {Object.entries(CATEGORIES).map(([key, cat]) => {
                  const isSelected = selectedCategory === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedCategory(isSelected ? '' : key as any)}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? `${cat.color} text-white border-transparent`
                          : `border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500`
                      }`}
                    >
                      <div className={`w-4 h-4 rounded ${isSelected ? 'bg-white/30' : cat.color}`}></div>
                      <span className="font-medium flex-1 text-left">{cat.label}</span>
                      {isSelected && (
                        <X size={16} className="ml-auto" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Pessoas
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PEOPLE).map(([key, person]) => {
                  const isSelected = selectedPeople.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => togglePerson(key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all ${
                        isSelected
                          ? `${person.color} text-white border-transparent`
                          : `border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500`
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isSelected ? 'bg-white/30 text-white' : `${person.color} text-white`
                      }`}>
                        {person.initials}
                      </div>
                      <span className="text-sm font-medium">{person.name}</span>
                      {isSelected && (
                        <X size={14} className="ml-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAssignment}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
