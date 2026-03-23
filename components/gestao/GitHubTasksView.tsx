'use client';

import { useEffect, useState, useMemo, useRef } from 'react';

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
}

interface GitHubUser {
  login: string;
  avatar_url: string;
}

interface GitHubMilestone {
  title: string;
  due_on: string | null;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  user: GitHubUser;
  body: string | null;
  comments: number;
  milestone?: GitHubMilestone | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
}

interface GitHubResponse {
  issues: GitHubIssue[];
  total: number;
  repository: string;
}

interface PersonStats {
  login: string;
  avatar: string;
  openIssues: number;
  closedIssues: number;
  totalHours: number;
}

export default function GitHubTasksView() {
  const [data, setData] = useState<GitHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [periodFilter, setPeriodFilter] = useState<string>('all'); // 'all', 'last30', 'last90', 'last180', 'thisYear', 'lastYear'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<string>('all');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'cards' | 'table'>('cards');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedLabel, setSelectedLabel] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const cacheKeyRef = useRef<string>('');

  // Função para limpar todos os caches
  const clearAllCaches = () => {
    try {
      // Limpar sessionStorage
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.startsWith('github-issues-')) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Limpar localStorage (dados antigos)
      const localKeys = Object.keys(localStorage);
      localKeys.forEach(key => {
        if (key.startsWith('github-issues-')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('✓ Caches limpos com sucesso');
      
      // Recarregar dados
      fetchIssues(true);
    } catch (e) {
      console.error('Erro ao limpar caches:', e);
      alert('Erro ao limpar caches. Tente recarregar a página.');
    }
  };

  useEffect(() => {
    // Limpar possíveis caches antigos do localStorage (migração)
    try {
      const oldKeys = Object.keys(localStorage).filter(k => k.startsWith('github-issues-'));
      oldKeys.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      // Ignorar erro de localStorage
    }

    // Carrega do cache do navegador se existir
    const cacheKey = `github-issues-${filter}-${periodFilter}`;
    cacheKeyRef.current = cacheKey;
    
    try {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        
        // Validar se o cache é do período correto
        // Se for 'all', verificar se realmente tem dados antigos
        if (periodFilter === 'all') {
          // Para 'all', só aceitar cache se tiver issues de antes de 2026
          const hasOldIssues = parsed.data.issues.some((issue: GitHubIssue) => {
            const createdDate = new Date(issue.created_at);
            return createdDate.getFullYear() < 2026;
          });
          
          // Se não tem issues antigas, o cache pode estar incompleto
          if (!hasOldIssues && parsed.data.total < 50) {
            // Cache suspeito, buscar novamente
            console.log('Cache incompleto detectado, buscando novamente...');
            sessionStorage.removeItem(cacheKey);
            fetchIssues();
            return;
          }
        }
        
        setData(parsed.data);
        setLastUpdate(new Date(parsed.timestamp));
        setLoading(false);
        return;
      }
    } catch (e) {
      // Se falhar ao parsear ou acessar sessionStorage, busca normalmente
      console.warn('Erro ao ler cache:', e);
    }
    
    // Se não tem cache, busca do servidor
    fetchIssues();
  }, [filter, periodFilter]);

  const fetchIssues = async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
      // Limpar cache quando forçar atualização
      sessionStorage.removeItem(cacheKeyRef.current);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      // Calcula a data 'since' baseado no filtro de período
      let sinceParam = '';
      if (periodFilter !== 'all') {
        const now = new Date();
        let sinceDate: Date;
        
        if (periodFilter === 'last30') {
          sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (periodFilter === 'last90') {
          sinceDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        } else if (periodFilter === 'last180') {
          sinceDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        } else if (periodFilter === 'thisYear') {
          sinceDate = new Date(now.getFullYear(), 0, 1);
        } else if (periodFilter === 'lastYear') {
          sinceDate = new Date(now.getFullYear() - 1, 0, 1);
        } else {
          sinceDate = now;
        }
        
        sinceParam = `&since=${sinceDate.toISOString()}`;
      }
      
      // Adiciona timestamp para forçar refresh do cache quando necessário
      const timestamp = forceRefresh ? `&_t=${Date.now()}` : '';
      const url = `/api/github-issues?state=${filter}${sinceParam}${timestamp}`;
      
      console.log('🔍 Buscando issues:', { 
        filter, 
        periodFilter, 
        sinceParam: sinceParam || 'SEM FILTRO (todas as issues)',
        url 
      });
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Erro ao buscar tarefas do GitHub');
      }
      const data = await response.json();
      
      console.log('✓ Issues recebidas:', {
        total: data.total,
        oldestIssue: data.issues.length > 0 ? data.issues[data.issues.length - 1].created_at : 'N/A',
        newestIssue: data.issues.length > 0 ? data.issues[0].created_at : 'N/A'
      });
      
      setData(data);
      const now = new Date();
      setLastUpdate(now);
      
      // Salvar no cache do navegador (sempre, mesmo com refresh forçado)
      try {
        // Limitar o que é guardado no cache - apenas os dados essenciais
        const cacheData = {
          data: {
            issues: data.issues.map((issue: GitHubIssue) => ({
              id: issue.id,
              number: issue.number,
              title: issue.title,
              state: issue.state,
              html_url: issue.html_url,
              created_at: issue.created_at,
              updated_at: issue.updated_at,
              labels: issue.labels,
              assignees: issue.assignees.map((a: GitHubUser) => ({
                login: a.login,
                avatar_url: a.avatar_url
              })),
              user: { login: issue.user.login, avatar_url: issue.user.avatar_url },
              comments: issue.comments,
              milestone: issue.milestone,
              // Campos customizados do projeto
              startDate: issue.startDate,
              endDate: issue.endDate,
              status: issue.status,
              // Não cachear body completo para economizar espaço
              body: issue.body ? issue.body.substring(0, 500) : null
            })),
            total: data.total,
            repository: data.repository
          },
          timestamp: now.toISOString()
        };
        
        sessionStorage.setItem(cacheKeyRef.current, JSON.stringify(cacheData));
      } catch (storageError) {
        // Se der erro de quota, limpar outros caches e tentar novamente
        if (storageError instanceof Error && storageError.name === 'QuotaExceededError') {
          console.warn('SessionStorage cheio, limpando caches antigos...');
          try {
            // Limpar todos os caches de GitHub issues, exceto o atual
            const keys = Object.keys(sessionStorage);
            keys.forEach(key => {
              if (key.startsWith('github-issues-') && key !== cacheKeyRef.current) {
                sessionStorage.removeItem(key);
              }
            });
            // Tentar salvar novamente (versão menor)
            const minimalCache = {
              data: { issues: [], total: data.total, repository: data.repository },
              timestamp: now.toISOString()
            };
            sessionStorage.setItem(cacheKeyRef.current, JSON.stringify(minimalCache));
          } catch (e) {
            // Se ainda assim falhar, ignora o cache
            console.error('Não foi possível salvar cache:', e);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Mapeamento de size (Fibonacci) para horas
  const SIZE_TO_HOURS: Record<number, { hours: number; description: string }> = {
    1: { hours: 1, description: 'Menos de 1h - trivial' },
    2: { hours: 2, description: '1-2h - simples' },
    3: { hours: 4, description: 'Meio dia - moderada' },
    5: { hours: 8, description: '1 dia - considerável' },
    8: { hours: 20, description: '2-3 dias - grande' },
    13: { hours: 40, description: '1 semana - muito complexa' },
    21: { hours: 80, description: '2 semanas - extremamente complexa' }
  };

  // Extrai horas de labels "size:" ou campos custom startDate/endDate
  const extractHours = (issue: GitHubIssue): number => {
    // 1. Prioridade: Label com "size:" usando escala Fibonacci
    for (const label of issue.labels) {
      const match = label.name.match(/size[:\s]+(\d+)/i);
      if (match) {
        const sizeValue = parseInt(match[1]);
        
        // Verifica se é um valor válido da escala Fibonacci
        if (SIZE_TO_HOURS[sizeValue]) {
          return SIZE_TO_HOURS[sizeValue].hours;
        }
        
        // Se não for Fibonacci padrão, interpreta como horas diretas
        return sizeValue;
      }
    }
    
    // 2. Campos custom startDate e endDate
    // GitHub issues podem ter campos custom no body com formato específico
    if (issue.body) {
      const startDateMatch = issue.body.match(/startDate[:\s]+(\d{4}-\d{2}-\d{2})/i);
      const endDateMatch = issue.body.match(/endDate[:\s]+(\d{4}-\d{2}-\d{2})/i);
      
      if (startDateMatch && endDateMatch) {
        const startDate = new Date(startDateMatch[1]);
        const endDate = new Date(endDateMatch[1]);
        
        // Calcular dias úteis (aproximado: total de dias / 7 * 5)
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Converter para dias úteis (aproximado)
        const workDays = Math.round((diffDays / 7) * 5) || diffDays;
        
        // Cada dia útil = 8 horas
        return workDays * 8;
      }
    }
    
    // 3. Padrão: 8 horas (1 dia de trabalho)
    return 8;
  };

  // Retorna descrição de como as horas foram calculadas
  const getHoursSource = (issue: GitHubIssue): string => {
    // Verifica label size:
    for (const label of issue.labels) {
      const match = label.name.match(/size[:\s]+(\d+)/i);
      if (match) {
        const sizeValue = parseInt(match[1]);
        
        if (SIZE_TO_HOURS[sizeValue]) {
          return `Size ${sizeValue}: ${SIZE_TO_HOURS[sizeValue].description}`;
        }
        
        return `Definido na label "${label.name}" (${sizeValue}h)`;
      }
    }
    
    // Verifica campos custom startDate/endDate
    if (issue.body) {
      const startDateMatch = issue.body.match(/startDate[:\s]+(\d{4}-\d{2}-\d{2})/i);
      const endDateMatch = issue.body.match(/endDate[:\s]+(\d{4}-\d{2}-\d{2})/i);
      
      if (startDateMatch && endDateMatch) {
        return `Calculado entre ${startDateMatch[1]} e ${endDateMatch[1]}`;
      }
    }
    
    return 'Estimativa padrão (8h = 1 dia)';
  };

  // Calcula estatísticas
  const stats = useMemo(() => {
    if (!data) return null;

    const openIssues = data.issues.filter(i => i.state === 'open');
    const closedIssues = data.issues.filter(i => i.state === 'closed');
    
    const totalHours = data.issues.reduce((sum, issue) => sum + extractHours(issue), 0);
    const openHours = openIssues.reduce((sum, issue) => sum + extractHours(issue), 0);
    const closedHours = closedIssues.reduce((sum, issue) => sum + extractHours(issue), 0);
    
    // Estatísticas por pessoa
    const peopleMap = new Map<string, PersonStats>();
    
    data.issues.forEach(issue => {
      const hours = extractHours(issue);
      
      if (issue.assignees.length === 0) {
        // Sem atribuição
        if (!peopleMap.has('unassigned')) {
          peopleMap.set('unassigned', {
            login: 'Sem atribuição',
            avatar: '',
            openIssues: 0,
            closedIssues: 0,
            totalHours: 0
          });
        }
        const stat = peopleMap.get('unassigned')!;
        if (issue.state === 'open') stat.openIssues++;
        else stat.closedIssues++;
        stat.totalHours += hours;
      } else {
        issue.assignees.forEach(assignee => {
          if (!peopleMap.has(assignee.login)) {
            peopleMap.set(assignee.login, {
              login: assignee.login,
              avatar: assignee.avatar_url,
              openIssues: 0,
              closedIssues: 0,
              totalHours: 0
            });
          }
          const stat = peopleMap.get(assignee.login)!;
          if (issue.state === 'open') stat.openIssues++;
          else stat.closedIssues++;
          stat.totalHours += hours;
        });
      }
    });
    
    const peopleStats = Array.from(peopleMap.values()).sort((a, b) => b.totalHours - a.totalHours);
    
    // Estatísticas por label
    const labelMap = new Map<string, { count: number; hours: number; color: string }>();
    data.issues.forEach(issue => {
      const hours = extractHours(issue);
      issue.labels.forEach(label => {
        if (!labelMap.has(label.name)) {
          labelMap.set(label.name, { count: 0, hours: 0, color: label.color });
        }
        const stat = labelMap.get(label.name)!;
        stat.count++;
        stat.hours += hours;
      });
    });
    
    const topLabels = Array.from(labelMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Milestones
    const milestoneMap = new Map<string, { count: number; hours: number }>();
    data.issues.forEach(issue => {
      if (issue.milestone) {
        const name = issue.milestone.title;
        if (!milestoneMap.has(name)) {
          milestoneMap.set(name, { count: 0, hours: 0 });
        }
        const stat = milestoneMap.get(name)!;
        stat.count++;
        stat.hours += extractHours(issue);
      }
    });
    
    const milestones = Array.from(milestoneMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.hours - a.hours);

    return {
      total: data.issues.length,
      open: openIssues.length,
      closed: closedIssues.length,
      totalHours,
      openHours,
      closedHours,
      avgHoursPerIssue: Math.round(totalHours / data.issues.length),
      progress: data.issues.length > 0 ? Math.round((closedIssues.length / data.issues.length) * 100) : 0,
      peopleStats,
      topLabels,
      milestones
    };
  }, [data]);

  const getStateBadgeColor = (state: string) => {
    return state === 'open' 
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const getPriorityColor = (issue: GitHubIssue) => {
    const hasPriority = issue.labels.find(l => 
      l.name.toLowerCase().includes('priority') || 
      l.name.toLowerCase().includes('prioridade')
    );
    
    if (hasPriority) {
      if (hasPriority.name.toLowerCase().includes('high') || hasPriority.name.toLowerCase().includes('alta')) {
        return 'border-l-4 border-red-500';
      }
      if (hasPriority.name.toLowerCase().includes('medium') || hasPriority.name.toLowerCase().includes('média')) {
        return 'border-l-4 border-yellow-500';
      }
      if (hasPriority.name.toLowerCase().includes('low') || hasPriority.name.toLowerCase().includes('baixa')) {
        return 'border-l-4 border-green-500';
      }
    }
    return 'border-l-4 border-gray-300';
  };

  const filteredIssues = useMemo(() => {
    let issues = data?.issues || [];
    
    // Filtro de busca
    if (searchTerm) {
      issues = issues.filter(issue =>
        issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.body?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.labels.some(label => label.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Filtro de pessoa
    if (selectedPerson !== 'all') {
      if (selectedPerson === 'unassigned') {
        issues = issues.filter(issue => issue.assignees.length === 0);
      } else {
        issues = issues.filter(issue => 
          issue.assignees.some(a => a.login === selectedPerson)
        );
      }
    }
    
    // Filtro de status
    if (selectedStatus !== 'all') {
      issues = issues.filter(issue => {
        const issueStatus = issue.status || (issue.state === 'open' ? 'Sprint' : 'Closed');
        return issueStatus === selectedStatus;
      });
    }
    
    // Filtro de label
    if (selectedLabel !== 'all') {
      issues = issues.filter(issue => 
        issue.labels.some(label => label.name === selectedLabel)
      );
    }
    
    // Filtro de estado (open/closed)
    if (selectedState !== 'all') {
      issues = issues.filter(issue => issue.state === selectedState);
    }
    
    return issues;
  }, [data, searchTerm, selectedPerson, selectedStatus, selectedLabel, selectedState]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Erro ao carregar tarefas
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => fetchIssues(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard de Gestão - GitHub
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            <span className="font-mono">{data?.repository}</span>
            {' · '}
            Visão gerencial completa
            {' · '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {periodFilter === 'all' ? 'Todas as issues' :
               periodFilter === 'last30' ? 'Últimos 30 dias' :
               periodFilter === 'last90' ? 'Últimos 90 dias' :
               periodFilter === 'last180' ? 'Últimos 180 dias' :
               periodFilter === 'thisYear' ? 'Este ano (2026)' :
               periodFilter === 'lastYear' ? 'Ano passado (2025)' : ''}
            </span>
            {lastUpdate && (
              <>
                {' · '}
                <span className="text-xs">
                  Atualizado às {lastUpdate.toLocaleTimeString('pt-BR')}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filtro de período */}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          >
            <option value="all">📅 Todas as issues</option>
            <option value="last30">🗓️ Últimos 30 dias</option>
            <option value="last90">📊 Últimos 90 dias</option>
            <option value="last180">📈 Últimos 180 dias</option>
            <option value="thisYear">🎯 Este ano (2026)</option>
            <option value="lastYear">🕐 Ano passado (2025)</option>
          </select>
          
          <button
            onClick={() => fetchIssues(true)}
            disabled={isRefreshing}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg 
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
          
          {/* Botão de Limpar Cache */}
          <button
            onClick={clearAllCaches}
            disabled={isRefreshing}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Limpar cache e recarregar dados"
          >
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Limpar Cache
          </button>
          
          {/* Tooltip de cálculo de horas */}
          <div className="group relative">
            <button className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <div className="absolute right-0 mt-2 w-96 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Como as horas são calculadas?</h4>
              
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-blue-600 dark:text-blue-400">1.</span>
                    <strong className="text-sm">Label "size:" (Escala Fibonacci)</strong>
                  </div>
                  <div className="ml-6 text-xs space-y-1 text-gray-600 dark:text-gray-400">
                    <div className="grid grid-cols-2 gap-1">
                      <div><strong>size:1</strong> → 1h (trivial)</div>
                      <div><strong>size:2</strong> → 2h (simples)</div>
                      <div><strong>size:3</strong> → 4h (meio dia)</div>
                      <div><strong>size:5</strong> → 8h (1 dia)</div>
                      <div><strong>size:8</strong> → 20h (2-3 dias)</div>
                      <div><strong>size:13</strong> → 40h (1 semana)</div>
                      <div><strong>size:21</strong> → 80h (2 semanas)</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-blue-600 dark:text-blue-400">2.</span>
                    <strong className="text-sm">Campos custom na descrição</strong>
                  </div>
                  <div className="ml-6 text-xs text-gray-600 dark:text-gray-400">
                    <div className="font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded mb-1">
                      startDate: 2026-03-01<br/>
                      endDate: 2026-03-05
                    </div>
                    <div>Calcula dias úteis × 8h/dia</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-600 dark:text-blue-400">3.</span>
                    <strong className="text-sm">Padrão: 8h (1 dia)</strong>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-500 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                💡 Passe o mouse sobre o badge laranja de horas para ver de onde veio o cálculo
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md border border-gray-200 dark:border-gray-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded-bl-lg" title="Dados em cache (carrega 1x por sessão)">
            ⚡ Cache Local
          </div>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total de Tarefas</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Abertas</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.open}</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                <path fillRule="evenodd" d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Concluídas</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.closed}</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 16 16">
                <path d="M11.28 6.78a.75.75 0 00-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l3.5-3.5z"/>
                <path fillRule="evenodd" d="M16 8A8 8 0 110 8a8 8 0 0116 0zm-1.5 0a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total de Horas</p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.totalHours}h</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Abertas: {stats.openHours}h
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Progresso</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.progress}%</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all"
                  style={{ width: `${stats.progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'open'
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Abertas
          </button>
          <button
            onClick={() => setFilter('closed')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'closed'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Fechadas
          </button>
        </div>

        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar tarefas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* People Stats & Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* People Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            Alocação por Pessoa
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {stats.peopleStats.map((person) => (
              <div 
                key={person.login}
                onClick={() => setSelectedPerson(selectedPerson === person.login ? 'all' : person.login)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedPerson === person.login
                    ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500'
                    : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {person.avatar ? (
                      <img 
                        src={person.avatar} 
                        alt={person.login}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-400 dark:bg-gray-600 flex items-center justify-center text-white font-bold">
                        ?
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {person.login}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {person.openIssues + person.closedIssues} tarefas · {person.totalHours}h
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs font-medium">
                      {person.openIssues}
                    </span>
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs font-medium">
                      {person.closedIssues}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestones & Top Labels */}
        <div className="space-y-6">
          {/* Milestones */}
          {stats.milestones.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                Milestones
              </h3>
              <div className="space-y-2">
                {stats.milestones.map((milestone, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
                      {milestone.name}
                    </span>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {milestone.count} tasks
                      </span>
                      <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded text-xs font-medium">
                        {milestone.hours}h
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Labels */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
              </svg>
              Top 5 Labels
            </h3>
            <div className="space-y-2">
              {stats.topLabels.map((label, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span 
                    className="px-2 py-1 rounded text-xs font-medium truncate flex-1 mr-2"
                    style={{
                      backgroundColor: `#${label.color}20`,
                      color: `#${label.color}`,
                      borderColor: `#${label.color}`,
                      border: '1px solid'
                    }}
                  >
                    {label.name}
                  </span>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {label.count}
                    </span>
                    <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded text-xs font-medium">
                      {label.hours}h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Issues List - Sub-tabs */}
      <div>
        {/* Sub-tabs Navigation */}
        <div className="flex items-center justify-between mb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveSubTab('cards')}
              className={`px-4 py-2 font-medium text-sm transition-all border-b-2 ${
                activeSubTab === 'cards'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              📊 Cards
            </button>
            <button
              onClick={() => setActiveSubTab('table')}
              className={`px-4 py-2 font-medium text-sm transition-all border-b-2 ${
                activeSubTab === 'table'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              📋 Tabela
            </button>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Tarefas ({filteredIssues.length})
            {(selectedPerson !== 'all' || selectedStatus !== 'all' || selectedLabel !== 'all' || selectedState !== 'all') && (
              <button
                onClick={() => {
                  setSelectedPerson('all');
                  setSelectedStatus('all');
                  setSelectedLabel('all');
                  setSelectedState('all');
                }}
                className="ml-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </h3>
        </div>

        {/* Barra de Filtros */}
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Filtro por Status */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos os Status</option>
                {Array.from(new Set(data?.issues.map(i => i.status || (i.state === 'open' ? 'Sprint' : 'Closed')) || [])).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Label */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Label
              </label>
              <select
                value={selectedLabel}
                onChange={(e) => setSelectedLabel(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todas as Labels</option>
                {Array.from(new Set(data?.issues.flatMap(i => i.labels.map(l => l.name)) || [])).sort().map(label => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Pessoa */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pessoa
              </label>
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todas as Pessoas</option>
                <option value="unassigned">Sem atribuição</option>
                {Array.from(new Set(data?.issues.flatMap(i => i.assignees.map(a => a.login)) || [])).sort().map(person => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Estado */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estado
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos os Estados</option>
                <option value="open">🟢 Aberto</option>
                <option value="closed">🔴 Fechado</option>
              </select>
            </div>
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400">
              Nenhuma tarefa encontrada
            </p>
          </div>
        ) : activeSubTab === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-all ${getPriorityColor(issue)}`}
              >
                {/* Issue Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {issue.state === 'open' ? (
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                          <path fillRule="evenodd" d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M11.28 6.78a.75.75 0 00-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l3.5-3.5z"/>
                          <path fillRule="evenodd" d="M16 8A8 8 0 110 8a8 8 0 0116 0zm-1.5 0a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"/>
                        </svg>
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400">#{issue.number}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatDate(issue.created_at)}</span>
                    </div>
                  </div>
                  <span 
                    className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded text-xs font-bold flex-shrink-0 cursor-help"
                    title={getHoursSource(issue)}
                  >
                    {extractHours(issue)}h
                  </span>
                </div>

                {/* Issue Title */}
                <a
                  href={issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 mb-2 line-clamp-2"
                  title={issue.title}
                >
                  {issue.title}
                </a>

                {/* Labels - max 2 */}
                {issue.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {issue.labels.slice(0, 2).map((label) => (
                      <span
                        key={label.id}
                        className="px-2 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: `#${label.color}20`,
                          color: `#${label.color}`,
                          borderColor: `#${label.color}`,
                          border: '1px solid'
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                    {issue.labels.length > 2 && (
                      <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
                        +{issue.labels.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    {/* Assignees */}
                    {issue.assignees.length > 0 ? (
                      <div className="flex -space-x-2">
                        {issue.assignees.slice(0, 2).map((assignee) => (
                          <img
                            key={assignee.login}
                            src={assignee.avatar_url}
                            alt={assignee.login}
                            className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800"
                            title={assignee.login}
                          />
                        ))}
                        {issue.assignees.length > 2 && (
                          <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300">
                            +{issue.assignees.length - 2}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">Sem atribuição</span>
                    )}
                  </div>

                  {/* Comments & Milestone */}
                  <div className="flex items-center gap-2">
                    {issue.milestone && (
                      <span className="text-xs text-gray-500 dark:text-gray-400" title={issue.milestone.title}>
                        📋
                      </span>
                    )}
                    {issue.comments > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {issue.comments}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Título</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Assignees</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Labels</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Start Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">End Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Horas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      <a href={issue.html_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400">
                        #{issue.number}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={issue.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                      >
                        {issue.title}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {issue.state === 'open' ? (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                            <path fillRule="evenodd" d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/>
                          </svg>
                          Aberto
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M11.28 6.78a.75.75 0 00-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l3.5-3.5z"/>
                            <path fillRule="evenodd" d="M16 8A8 8 0 110 8a8 8 0 0116 0zm-1.5 0a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"/>
                          </svg>
                          Fechado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {issue.assignees.length > 0 ? (
                        <div className="flex -space-x-2">
                          {issue.assignees.slice(0, 3).map((assignee) => (
                            <img
                              key={assignee.login}
                              src={assignee.avatar_url}
                              alt={assignee.login}
                              className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800"
                              title={assignee.login}
                            />
                          ))}
                          {issue.assignees.length > 3 && (
                            <div className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300">
                              +{issue.assignees.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const status = issue.status || (issue.state === 'open' ? 'Sprint' : 'Closed');
                        const statusColors: Record<string, string> = {
                          'Sprint': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
                          'Test': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
                          'Desenvolvimento': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                          'Atendimento': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                          'Alta Prioridade': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                          'Extração': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
                          'Design': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
                          'Closed': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
                        };
                        const colorClass = statusColors[status] || (issue.state === 'open' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200');
                        
                        return (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
                            {status}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {issue.labels.slice(0, 2).map((label) => (
                          <span
                            key={label.id}
                            className="px-2 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: `#${label.color}20`,
                              color: `#${label.color}`,
                              borderColor: `#${label.color}`,
                              border: '1px solid'
                            }}
                          >
                            {label.name}
                          </span>
                        ))}
                        {issue.labels.length > 2 && (
                          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
                            +{issue.labels.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {issue.startDate ? new Date(issue.startDate).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {issue.endDate ? new Date(issue.endDate).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded text-xs font-bold">
                        {extractHours(issue)}h
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
