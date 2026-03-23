export interface Task {
  id: string;
  project: string;
  phase: string;
  feature: string;
  assignments: Record<string, string[]>; // mês -> [semanas]
  responsible: string;
}

export interface Project {
  id: string;
  name: string;
  phases: Phase[];
}

export interface Phase {
  id: string;
  name: string;
  features: Feature[];
}

export interface Feature {
  id: string;
  name: string;
  description?: string;
  weeks: WeekAssignment[];
}

export interface WeekAssignment {
  month: string;
  weekNumber: number;
  responsible: string;
  assigned?: boolean;
  people?: string[]; // Array de pessoas: 'ian', 'gui', 'joe', 'guga'
  category?: 'desenvolvimento' | 'design' | 'te' | 'infra';
  status: 'planned' | 'in-progress' | 'completed' | 'delayed';
}

export interface TimelineData {
  months: Month[];
  projects: Project[];
  infrastructure?: Project[];
}

export interface Month {
  name: string;
  weeks: number;
}

export const MONTHS = [
  'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const CATEGORIES = {
  desenvolvimento: {
    label: 'Desen.',
    color: 'bg-blue-500',
    lightColor: 'bg-blue-100',
    darkColor: 'bg-blue-900',
    textColor: 'text-blue-700',
  },
  design: {
    label: 'Design',
    color: 'bg-purple-500',
    lightColor: 'bg-purple-100',
    darkColor: 'bg-purple-900',
    textColor: 'text-purple-700',
  },
  te: {
    label: 'TE',
    color: 'bg-orange-500',
    lightColor: 'bg-orange-100',
    darkColor: 'bg-orange-900',
    textColor: 'text-orange-700',
  },
  infra: {
    label: 'Infra',
    color: 'bg-yellow-600',
    lightColor: 'bg-yellow-100',
    darkColor: 'bg-yellow-900',
    textColor: 'text-yellow-700',
  },
};

export const PEOPLE = {
  ian: { name: 'Ian', color: 'bg-blue-600', initials: 'IA' },
  gui: { name: 'Gui', color: 'bg-green-600', initials: 'GU' },
  joe: { name: 'Joe', color: 'bg-purple-600', initials: 'JO' },
  guga: { name: 'Guga', color: 'bg-orange-600', initials: 'GG' },
  victor: { name: 'Victor', color: 'bg-red-600', initials: 'VI' },
  angelo: { name: 'Angelo', color: 'bg-teal-600', initials: 'AN' },
  carol: { name: 'Carol', color: 'bg-pink-600', initials: 'CA' },
  paulo: { name: 'Paulo', color: 'bg-cyan-600', initials: 'PA' },
  lucilene: { name: 'Lucilene', color: 'bg-indigo-600', initials: 'LU' },
};

export interface CronogramaState {
  data: TimelineData | null;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  setData: (data: TimelineData) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, project: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addFeature: (projectId: string, phaseId: string, feature: Feature) => void;
  updateFeature: (projectId: string, phaseId: string, featureId: string, feature: Partial<Feature>) => void;
  deleteFeature: (projectId: string, phaseId: string, featureId: string) => void;
}
