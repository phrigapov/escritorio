'use client';

import { useState, useRef, useEffect } from 'react';
import { useCronogramaStore } from '@/store/cronogramaStore';
import { MONTHS, WeekAssignment, CATEGORIES, PEOPLE } from '@/types/cronograma';
import { Lock, LockOpen, ChevronLeft, ChevronRight, X } from 'lucide-react';

// Lista de tarefas de infraestrutura
const INFRASTRUCTURE_TASKS = [
  'Mudança do docker swarm para kubernets',
  'Instâncias mais potêntes de banco de dados',
  'Criação de balanceamento de maquinas ec2 e não somente de containers',
  'Multicloud para redundancia',
  'Atualização do docker swarm',
  'Atualização do RDS (Instâncias)',
  'Atualização das Ec2 Amazon Linux',
  'Atualizações dos pacotes de sofware como Next e Node',
  'Contratação e migração para kong corporativo',
  'Reconstruir Docker swarm de Desenvolvimento (Esta com sérios problemas)',
  'Implementar metodologia de hibernação de containers',
  'Atualização e melhoria de Runners',
  'Atualização e melhorias de Actions/builds/compilações',
  'Atualização e melhorias de github/processos/automações',
  'Implementação e manutenção de observabilidade mais complexa',
  'Implementação e ajustes de e-mails/servidor/Lógica',
  'Manutenção de e-mails',
  'Implementação e migração de serviços restantes par GO (Livro Digital)',
  'Finalização da migração do identity-v2 e retirada total do identity',
  'Implementação de testes robustos e2e, componentes, unitários e integração',
  'Implementação completa do backstage para documentação, análise, testes e recursos',
  'Implementação e criação das bibliotecas de UI, storybook, package managers e NPM',
  'Implementação e migração dos livros digitais, retirar ftp, migrar imagens e conteudo para data-ms',
  'Migração, implementação do sme-icons e refatoração dos projetos',
];

export default function InfrastructureView() {
  const data = useCronogramaStore((state) => state.data);
  const updateProject = useCronogramaStore((state) => state.updateProject);
  const setData = useCronogramaStore((state) => state.setData);
  const [isLocked, setIsLocked] = useState(true);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [taskName, setTaskName] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  
  // Estados para drag-to-scroll
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Estados para modal de edição
  const [editingModal, setEditingModal] = useState<{
    taskId: string;
    month: string;
    weekNum: number;
    currentAssignment?: WeekAssignment;
    currentWeeks: WeekAssignment[];
  } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof CATEGORIES | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);

  // Encontrar o projeto de infraestrutura ou criar estrutura
  const infraProject = data?.projects.find(p => p.id === 'infrastructure');
  const infraPhase = infraProject?.phases[0];
  const infraFeatures = infraPhase?.features || [];

  // Inicializar tarefas se não existirem
  useEffect(() => {
    if (data && !infraProject) {
      // Criar projeto de infraestrutura
      const newProject = {
        id: 'infrastructure',
        name: 'Infraestrutura',
        phases: [{
          id: 'infra-tasks',
          name: 'Tarefas de Infraestrutura',
          features: INFRASTRUCTURE_TASKS.map((task, idx) => ({
            id: `infra-task-${idx}`,
            name: task,
            weeks: [] as WeekAssignment[],
          }))
        }]
      };
      
      // Adicionar ao store
      const updatedData = {
        ...data,
        projects: [...data.projects, newProject]
      };
      
      useCronogramaStore.getState().setData(updatedData);
    }
  }, [data, infraProject]);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      return () => container.removeEventListener('scroll', checkScroll);
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const scrollLeftButton = () => {
    if (scrollContainerRef.current) {
      const scrollPosition = scrollContainerRef.current.scrollLeft;
      scrollContainerRef.current.scrollTo({
        left: scrollPosition - 264,
        behavior: 'smooth',
      });
    }
  };

  const scrollRightButton = () => {
    if (scrollContainerRef.current) {
      const scrollPosition = scrollContainerRef.current.scrollLeft;
      scrollContainerRef.current.scrollTo({
        left: scrollPosition + 264,
        behavior: 'smooth',
      });
    }
  };

  if (!data || !infraProject) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg">Carregando infraestrutura...</p>
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

  const handleCellClick = (
    taskId: string,
    month: string,
    weekNum: number,
    currentAssignment: WeekAssignment | undefined,
    currentWeeks: WeekAssignment[]
  ) => {
    if (isLocked) return;
    
    setEditingModal({ taskId, month, weekNum, currentAssignment, currentWeeks });
    setSelectedCategory(currentAssignment?.category || null);
    setSelectedPeople(currentAssignment?.people || []);
  };

  const handleSaveAssignment = () => {
    if (!editingModal || !infraProject || !infraPhase) return;

    const { taskId, month, weekNum, currentWeeks } = editingModal;
    const updatedWeeks = [...currentWeeks];
    const existingIndex = updatedWeeks.findIndex(
      (w) => w.month === month && w.weekNumber === weekNum + 1
    );

    if (!selectedCategory && selectedPeople.length === 0) {
      // Remover atribuição
      if (existingIndex !== -1) {
        updatedWeeks.splice(existingIndex, 1);
      }
    } else {
      const assignment: WeekAssignment = {
        month,
        weekNumber: weekNum + 1,
        responsible: selectedCategory || 'desenvolvimento',
        category: selectedCategory || undefined,
        people: selectedPeople.length > 0 ? selectedPeople : undefined,
        status: 'planned',
      };

      if (existingIndex !== -1) {
        updatedWeeks[existingIndex] = assignment;
      } else {
        updatedWeeks.push(assignment);
      }
    }

    // Atualizar feature
    const updatedFeatures = infraFeatures.map(f =>
      f.id === taskId ? { ...f, weeks: updatedWeeks } : f
    );

    const updatedPhases = infraProject.phases.map(p =>
      p.id === infraPhase.id ? { ...p, features: updatedFeatures } : p
    );

    updateProject(infraProject.id, { phases: updatedPhases });
    setEditingModal(null);
  };

  const getMonthBackgroundColor = (monthIndex: number): string => {
    const colors = [
      'bg-blue-100/60 dark:bg-blue-900/20',
      'bg-purple-100/60 dark:bg-purple-900/20',
      'bg-green-100/60 dark:bg-green-900/20',
      'bg-yellow-100/60 dark:bg-yellow-900/20',
      'bg-pink-100/60 dark:bg-pink-900/20',
      'bg-indigo-100/60 dark:bg-indigo-900/20',
      'bg-orange-100/60 dark:bg-orange-900/20',
      'bg-emerald-100/60 dark:bg-emerald-900/20',
      'bg-violet-100/60 dark:bg-violet-900/20',
      'bg-teal-100/60 dark:bg-teal-900/20',
      'bg-red-100/60 dark:bg-red-900/20',
    ];
    return colors[monthIndex % colors.length];
  };

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow p-4">
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
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-all ${
              isLocked
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isLocked ? <Lock size={14} /> : <LockOpen size={14} />}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={scrollLeftButton}
            disabled={!canScrollLeft}
            className={`p-2 rounded-lg transition-all ${
              canScrollLeft
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={scrollRightButton}
            disabled={!canScrollRight}
            className={`p-2 rounded-lg transition-all ${
              canScrollRight
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="flex">
          {/* Coluna de tarefas */}
          <div className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 border-r-2 border-gray-300 dark:border-gray-600" style={{ minWidth: '400px', maxWidth: '400px' }}>
            <div className="h-16 flex items-center px-4 border-b-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">Tarefas de Infraestrutura</h3>
            </div>
            <div>
              {infraFeatures.map((task) => (
                <div
                  key={task.id}
                  className="px-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center"
                  style={{ height: '52px' }}
                >
                  {editingTask === task.id ? (
                    <input
                      type="text"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      onBlur={() => {
                        if (taskName.trim() && infraProject && infraPhase) {
                          const updatedFeatures = infraFeatures.map(f =>
                            f.id === task.id ? { ...f, name: taskName } : f
                          );
                          const updatedPhases = infraProject.phases.map(p =>
                            p.id === infraPhase.id ? { ...p, features: updatedFeatures } : p
                          );
                          updateProject(infraProject.id, { phases: updatedPhases });
                        }
                        setEditingTask(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      autoFocus
                      className="w-full px-2 py-1 text-sm border border-blue-500 rounded dark:bg-gray-700 dark:text-gray-200"
                    />
                  ) : (
                    <div
                      onClick={() => {
                        if (!isLocked) {
                          setEditingTask(task.id);
                          setTaskName(task.name);
                        }
                      }}
                      className={`text-sm text-gray-700 dark:text-gray-300 ${!isLocked ? 'cursor-pointer hover:text-blue-600' : ''}`}
                    >
                      {task.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline scrollável */}
          <div
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className="overflow-x-auto flex-1"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <div className="inline-block">
              {/* Header de meses */}
              <div className="flex sticky top-0 z-10">
                {data.months.map((month, monthIdx) => (
                  <div
                    key={month.name}
                    className={`${monthIdx < data.months.length - 1 ? 'border-r-2 border-gray-300 dark:border-gray-600' : ''}`}
                    style={{ width: `${month.weeks * 80}px`, flexShrink: 0 }}
                  >
                    <div className="h-16 flex items-center justify-center border-b-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
                      <div className="text-center">
                        <div className="font-bold text-gray-800 dark:text-gray-100">{month.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{month.weeks} semanas</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Linhas de tarefas */}
              <div>
                {infraFeatures.map((task) => (
                  <div key={task.id} className="flex" style={{ height: '52px' }}>
                    {data.months.map((month, monthIdx) => (
                      <div
                        key={month.name}
                        className={`${monthIdx < data.months.length - 1 ? 'border-r-2 border-gray-300 dark:border-gray-600' : ''} ${getMonthBackgroundColor(monthIdx)}`}
                        style={{ width: `${month.weeks * 80}px`, display: 'flex', flexShrink: 0 }}
                      >
                        {Array.from({ length: month.weeks }, (_, weekNum) => {
                          const assignment = task.weeks.find(
                            (w) => w.month === month.name && w.weekNumber === weekNum + 1
                          );

                          return (
                            <div
                              key={weekNum}
                              className="py-1 relative flex items-center justify-center border-b border-gray-200 dark:border-gray-700"
                              style={{ width: '80px', flex: '0 0 80px' }}
                            >
                              <div
                                onClick={() =>
                                  handleCellClick(
                                    task.id,
                                    month.name,
                                    weekNum,
                                    assignment,
                                    task.weeks
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
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 px-6 pb-6">
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
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key as any)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      selectedCategory === key
                        ? `${cat.color} text-white border-transparent`
                        : `border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500`
                    }`}
                  >
                    <div className={`w-4 h-4 rounded ${selectedCategory === key ? 'bg-white/30' : cat.color}`}></div>
                    <span className="font-medium">{cat.label}</span>
                  </button>
                ))}
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
  );
}
