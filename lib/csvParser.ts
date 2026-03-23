import Papa from 'papaparse';
import { Project, Phase, Feature, WeekAssignment, TimelineData, MONTHS } from '@/types/cronograma';

export function parseCSV(csvContent: string): TimelineData {
  const result = Papa.parse(csvContent, {
    delimiter: ';',
    skipEmptyLines: false,
  });

  const rows = result.data as string[][];
  
  // Identificar a linha com os cabeçalhos dos meses
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some(cell => cell?.includes('Fevereiro'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Cabeçalho dos meses não encontrado');
  }

  // Extrair estrutura dos meses e semanas
  const months = extractMonths(rows[headerRowIndex]);
  
  // Processar projetos
  const projects: Project[] = [];
  let currentProject: Project | null = null;
  let currentPhase: Phase | null = null;

  for (let i = headerRowIndex + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(cell => !cell || cell.trim() === '')) {
      continue;
    }

    const projectName = row[0]?.trim();
    const phaseName = row[1]?.trim();
    const featureName = row[2]?.trim();

    // Novo projeto
    if (projectName && projectName !== '') {
      if (currentProject) {
        projects.push(currentProject);
      }
      currentProject = {
        id: generateId(projectName),
        name: projectName,
        phases: [],
      };
      currentPhase = null;
    }

    // Nova fase
    if (phaseName && phaseName !== '' && currentProject) {
      currentPhase = {
        id: generateId(phaseName),
        name: phaseName,
        features: [],
      };
      currentProject.phases.push(currentPhase);
    }

    // Nova feature
    if (featureName && featureName !== '' && currentPhase) {
      const weeks = extractWeekAssignments(row.slice(3), months);
      const feature: Feature = {
        id: generateId(featureName),
        name: featureName,
        weeks,
      };
      currentPhase.features.push(feature);
    }
  }

  // Adicionar último projeto
  if (currentProject) {
    projects.push(currentProject);
  }

  return {
    months,
    projects,
  };
}

function extractMonths(headerRow: string[]) {
  const months = [];
  let currentMonth = '';
  
  for (let i = 3; i < headerRow.length; i++) {
    const cell = headerRow[i]?.trim();
    if (cell && MONTHS.some(m => cell.includes(m))) {
      currentMonth = MONTHS.find(m => cell.includes(m)) || '';
      if (currentMonth) {
        // Contar semanas para este mês
        let weekCount = 0;
        for (let j = i; j < headerRow.length; j++) {
          if (headerRow[j]?.includes('Semana')) {
            weekCount++;
          } else if (headerRow[j]?.trim() && MONTHS.some(m => headerRow[j].includes(m))) {
            break;
          }
        }
        months.push({ name: currentMonth, weeks: weekCount || 4 });
      }
    }
  }
  
  return months;
}

function extractWeekAssignments(cells: string[], months: any[]): WeekAssignment[] {
  const assignments: WeekAssignment[] = [];
  let cellIndex = 0;
  
  for (const month of months) {
    for (let week = 1; week <= month.weeks; week++) {
      const responsible = cells[cellIndex]?.trim() || '';
      if (responsible) {
        assignments.push({
          month: month.name,
          weekNumber: week,
          responsible,
          status: 'planned',
        });
      }
      cellIndex++;
    }
  }
  
  return assignments;
}

function generateId(name: string): string {
  return name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function exportToCSV(data: TimelineData): string {
  const rows: string[][] = [];
  
  // Header
  rows.push(['Tecnologia e Inteligência Educacional - SME/SUPEB']);
  rows.push([]);
  
  // Month headers
  const monthHeader = ['', '', 'Features'];
  data.months.forEach(month => {
    monthHeader.push(month.name);
    for (let i = 1; i < month.weeks; i++) {
      monthHeader.push('');
    }
  });
  rows.push(monthHeader);
  
  // Week headers
  const weekHeader = ['', '', ''];
  data.months.forEach(month => {
    for (let i = 1; i <= month.weeks; i++) {
      weekHeader.push(`Semana ${i}`);
    }
  });
  rows.push(weekHeader);
  
  // Data rows
  data.projects.forEach(project => {
    project.phases.forEach((phase, phaseIndex) => {
      phase.features.forEach((feature, featureIndex) => {
        const row = [
          phaseIndex === 0 && featureIndex === 0 ? project.name : '',
          featureIndex === 0 ? phase.name : '',
          feature.name,
        ];
        
        // Add week assignments
        let assignmentIndex = 0;
        data.months.forEach(month => {
          for (let week = 1; week <= month.weeks; week++) {
            const assignment = feature.weeks.find(
              w => w.month === month.name && w.weekNumber === week
            );
            row.push(assignment?.responsible || '');
            assignmentIndex++;
          }
        });
        
        rows.push(row);
      });
    });
    rows.push([]); // Empty row between projects
  });
  
  return Papa.unparse(rows, { delimiter: ';' });
}
