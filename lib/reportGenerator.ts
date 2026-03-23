// @ts-nocheck
import pptxgen from 'pptxgenjs';
import { TimelineData, Project, CATEGORIES, PEOPLE, WeekAssignment } from '@/types/cronograma';

const HOURS_PER_DAY = 8;
const DAYS_PER_WEEK = 5;
const HOURS_PER_WEEK = HOURS_PER_DAY * DAYS_PER_WEEK; // 40 horas

// Mapeamento de cores do Tailwind para hexadecimal
const COLOR_MAP: Record<string, string> = {
  'bg-blue-500': '3B82F6',
  'bg-blue-600': '2563EB',
  'bg-purple-500': '8B5CF6',
  'bg-purple-600': '9333EA',
  'bg-orange-500': 'F97316',
  'bg-orange-600': 'EA580C',
  'bg-yellow-600': 'CA8A04',
  'bg-green-600': '16A34A',
  'bg-red-600': 'DC2626',
  'bg-teal-600': '0D9488',
  'bg-pink-600': 'DB2777',
  'bg-cyan-600': '0891B2',
  'bg-indigo-600': '4F46E5',
};

function getHexColor(tailwindClass: string): string {
  return COLOR_MAP[tailwindClass] || '6B7280'; // gray-500 como fallback
}

interface CategoryStat {
  name: string;
  weeks: number;
  hours: number;
  color: string;
}

interface PersonStat {
  name: string;
  weeks: number;
  hours: number;
  initials: string;
  color: string;
}

// Verifica se uma semana está atribuída
function isWeekAssigned(week: WeekAssignment): boolean {
  return week.assigned === true || 
         (week.people && week.people.length > 0) || 
         week.category !== undefined ||
         (week.responsible && week.responsible !== '');
}

// Calcular estatísticas por categoria
function getCategoryStats(data: TimelineData): CategoryStat[] {
  const stats: Record<string, CategoryStat> = {};
  
  Object.keys(CATEGORIES).forEach(key => {
    stats[key] = {
      name: CATEGORIES[key as keyof typeof CATEGORIES].label,
      weeks: 0,
      hours: 0,
      color: CATEGORIES[key as keyof typeof CATEGORIES].color
    };
  });

  const allProjects = [...(data.projects || []), ...(data.infrastructure || [])];
  
  allProjects.forEach(project => {
    project.phases.forEach(phase => {
      phase.features.forEach(feature => {
        feature.weeks.forEach(week => {
          if (isWeekAssigned(week) && week.category) {
            const key = week.category;
            if (stats[key]) {
              stats[key].weeks++;
              stats[key].hours += HOURS_PER_WEEK;
            }
          }
        });
      });
    });
  });

  return Object.values(stats).filter(s => s.weeks > 0);
}

// Calcular estatísticas por pessoa
function getPeopleStats(data: TimelineData): PersonStat[] {
  const stats: Record<string, PersonStat> = {};
  
  Object.keys(PEOPLE).forEach(key => {
    stats[key] = {
      name: PEOPLE[key as keyof typeof PEOPLE].name,
      weeks: 0,
      hours: 0,
      initials: PEOPLE[key as keyof typeof PEOPLE].initials,
      color: PEOPLE[key as keyof typeof PEOPLE].color
    };
  });

  const allProjects = [...(data.projects || []), ...(data.infrastructure || [])];
  
  allProjects.forEach(project => {
    project.phases.forEach(phase => {
      phase.features.forEach(feature => {
        feature.weeks.forEach(week => {
          if (isWeekAssigned(week) && week.people && week.people.length > 0) {
            week.people.forEach(personKey => {
              if (stats[personKey]) {
                stats[personKey].weeks++;
                stats[personKey].hours += HOURS_PER_WEEK;
              }
            });
          }
        });
      });
    });
  });

  return Object.values(stats).filter(s => s.weeks > 0).sort((a, b) => b.hours - a.hours);
}

// Slide 1: Título
function addTitleSlide(pptx: pptxgen) {
  const slide = pptx.addSlide();
  slide.background = { color: '1F2937' };
  slide.addText('Sistema de Cronograma TE 2026', {
    x: 0.5, y: 2, w: 9, h: 1,
    fontSize: 44, bold: true, color: 'FFFFFF', align: 'center'
  });
  slide.addText('SME/SUPEB - Projetos de Tecnologia Educacional', {
    x: 0.5, y: 3.2, w: 9, h: 0.5,
    fontSize: 20, color: 'D1D5DB', align: 'center'
  });
  slide.addText(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, {
    x: 0.5, y: 5, w: 9, h: 0.3,
    fontSize: 14, color: '9CA3AF', align: 'center', italic: true
  });
}

// Slide 2: Resumo Executivo
function addExecutiveSummary(pptx: pptxgen, data: TimelineData) {
  const slide = pptx.addSlide();
  slide.addText('Resumo Executivo', { x: 0.5, y: 0.3, fontSize: 32, bold: true, color: '1F2937' });
  
  const allProjects = [...(data.projects || []), ...(data.infrastructure || [])];
  let totalFeatures = 0;
  let totalWeeks = 0;
  
  allProjects.forEach(project => {
    project.phases.forEach(phase => {
      totalFeatures += phase.features.length;
      phase.features.forEach(feature => {
        totalWeeks += feature.weeks.filter(w => isWeekAssigned(w)).length;
      });
    });
  });
  
  const totalHours = totalWeeks * HOURS_PER_WEEK;
  
  // Cards de estatísticas
  const cards = [
    { label: 'Projetos', value: allProjects.length.toString(), color: '3B82F6' },
    { label: 'Features', value: totalFeatures.toString(), color: '8B5CF6' },
    { label: 'Semanas', value: totalWeeks.toString(), color: 'F59E0B' },
    { label: 'Horas Totais', value: totalHours.toLocaleString('pt-BR'), color: 'EF4444' }
  ];
  
  cards.forEach((card, i) => {
    const x = 0.5 + (i * 2.3);
    slide.addShape(pptx.ShapeType.rect, {
      x, y: 1.2, w: 2.1, h: 1.2,
      fill: { color: card.color }, line: { width: 0 }
    });
    slide.addText(card.value, {
      x, y: 1.4, w: 2.1, h: 0.5,
      fontSize: 32, bold: true, color: 'FFFFFF', align: 'center'
    });
    slide.addText(card.label, {
      x, y: 1.9, w: 2.1, h: 0.3,
      fontSize: 14, color: 'FFFFFF', align: 'center'
    });
  });
  
  // Tabela por categoria
  const categoryStats = getCategoryStats(data);
  const tableData = [
    [
      { text: 'Categoria', options: { bold: true, fill: '1F2937', color: 'FFFFFF' } },
      { text: 'Semanas', options: { bold: true, fill: '1F2937', color: 'FFFFFF', align: 'center' } },
      { text: 'Horas', options: { bold: true, fill: '1F2937', color: 'FFFFFF', align: 'center' } }
    ]
  ];
  
  categoryStats.forEach(stat => {
    tableData.push([
      { text: stat.name, options: { fill: stat.color + '20' } },
      { text: stat.weeks.toString(), options: { align: 'center' } },
      { text: stat.hours.toLocaleString('pt-BR') + 'h', options: { align: 'center' } }
    ]);
  });
  
  slide.addTable(tableData, {
    x: 0.5, y: 2.8, w: 9, h: 2.5,
    fontSize: 12, border: { pt: 1, color: 'E5E7EB' }
  });
}

// Slide 3: Distribuição por Categoria (Gráficos)
function addCategoryDistribution(pptx: pptxgen, data: TimelineData) {
  const slide = pptx.addSlide();
  slide.addText('Distribuição por Categoria', { x: 0.5, y: 0.3, fontSize: 32, bold: true });
  
  const stats = getCategoryStats(data);
  
  // Gráfico de Pizza - Distribuição de Semanas
  const pieData = stats.map(s => ({ name: s.name, labels: [s.name], values: [s.weeks] }));
  slide.addChart(pptx.ChartType.pie, pieData, {
    x: 0.5, y: 1.2, w: 4.5, h: 4,
    showTitle: true, title: 'Distribuição de Semanas',
    showPercent: true,
    chartColors: stats.map(s => getHexColor(s.color))
  });
  
  // Gráfico de Barras - Horas por Categoria
  const barData = [{
    name: 'Horas',
    labels: stats.map(s => s.name),
    values: stats.map(s => s.hours)
  }];
  slide.addChart(pptx.ChartType.bar, barData, {
    x: 5.2, y: 1.2, w: 4.5, h: 4,
    showTitle: true, title: 'Horas por Categoria',
    barDir: 'col',
    showValue: true,
    chartColors: stats.map(s => getHexColor(s.color))
  });
}

// Slide 4: Distribuição por Pessoa
function addPeopleDistribution(pptx: pptxgen, data: TimelineData) {
  const slide = pptx.addSlide();
  slide.addText('Distribuição por Pessoa', { x: 0.5, y: 0.3, fontSize: 32, bold: true });
  
  const stats = getPeopleStats(data);
  
  // Tabela
  const tableData = [
    [
      { text: 'Pessoa', options: { bold: true, fill: '1F2937', color: 'FFFFFF' } },
      { text: 'Semanas', options: { bold: true, fill: '1F2937', color: 'FFFFFF', align: 'center' } },
      { text: 'Horas', options: { bold: true, fill: '1F2937', color: 'FFFFFF', align: 'center' } }
    ]
  ];
  
  stats.forEach(stat => {
    tableData.push([
      { text: stat.name, options: { fill: stat.color + '20' } },
      { text: stat.weeks.toString(), options: { align: 'center' } },
      { text: stat.hours.toLocaleString('pt-BR') + 'h', options: { align: 'center' } }
    ]);
  });
  
  slide.addTable(tableData, {
    x: 0.5, y: 1.2, w: 4.2, h: 4,
    fontSize: 12, border: { pt: 1, color: 'E5E7EB' }
  });
  
  // Gráfico de Barras - Top 10
  const top10 = stats.slice(0, 10);
  const barData = [{
    name: 'Horas',
    labels: top10.map(s => s.initials),
    values: top10.map(s => s.hours)
  }];
  
  slide.addChart(pptx.ChartType.bar, barData, {
    x: 5, y: 1.2, w: 4.7, h: 4,
    showTitle: true, title: 'Top 10 - Alocação de Horas',
    barDir: 'col',
    showValue: true,
    chartColors: top10.map(s => getHexColor(s.color))
  });
}

// Slide 5: Carga de Trabalho Mensal
function addWorkloadAnalysis(pptx: pptxgen, data: TimelineData) {
  const slide = pptx.addSlide();
  slide.addText('Análise de Carga de Trabalho', { x: 0.5, y: 0.3, fontSize: 32, bold: true });
  
  // Agrupar por mês
  const monthlyData: Record<string, number> = {};
  const allProjects = [...(data.projects || []), ...(data.infrastructure || [])];
  
  allProjects.forEach(project => {
    project.phases.forEach(phase => {
      phase.features.forEach(feature => {
        feature.weeks.forEach((week, idx) => {
          if (isWeekAssigned(week)) {
            const monthKey = data.months[idx];
            if (monthKey) {
              monthlyData[monthKey] = (monthlyData[monthKey] || 0) + HOURS_PER_WEEK;
            }
          }
        });
      });
    });
  });
  
  const months = Object.keys(monthlyData);
  const hours = Object.values(monthlyData);
  
  // Gráfico de Linha
  const lineData = [{
    name: 'Horas',
    labels: months,
    values: hours
  }];
  
  slide.addChart(pptx.ChartType.line, lineData, {
    x: 0.5, y: 1.2, w: 9, h: 2.8,
    showTitle: true, title: 'Distribuição Mensal de Horas',
    showValue: false,
    chartColors: ['3B82F6']
  });
  
  // Tabela resumo
  const tableData = [
    [
      { text: 'Mês', options: { bold: true, fill: '1F2937', color: 'FFFFFF' } },
      { text: 'Horas', options: { bold: true, fill: '1F2937', color: 'FFFFFF', align: 'center' } }
    ]
  ];
  
  months.forEach((month, i) => {
    tableData.push([
      { text: month },
      { text: hours[i].toLocaleString('pt-BR') + 'h', options: { align: 'center' } }
    ]);
  });
  
  slide.addTable(tableData, {
    x: 3, y: 4.2, w: 4, h: 1.2,
    fontSize: 10, border: { pt: 1, color: 'E5E7EB' }
  });
}

// Slide 6: Visão Geral dos Projetos
function addProjectsOverview(pptx: pptxgen, data: TimelineData) {
  const slide = pptx.addSlide();
  slide.addText('Visão Geral dos Projetos', { x: 0.5, y: 0.3, fontSize: 32, bold: true });
  
  const projectList = (data.projects || []).map(p => {
    const featuresCount = p.phases.reduce((sum, ph) => sum + ph.features.length, 0);
    let weeksCount = 0;
    p.phases.forEach(ph => {
      ph.features.forEach(f => {
        weeksCount += f.weeks.filter(w => isWeekAssigned(w)).length;
      });
    });
    return `• ${p.name}: ${featuresCount} features, ${weeksCount} semanas (${weeksCount * HOURS_PER_WEEK}h)`;
  });
  
  const infraCount = (data.infrastructure || []).length;
  let infraWeeks = 0;
  (data.infrastructure || []).forEach(p => {
    p.phases.forEach(ph => {
      ph.features.forEach(f => {
        infraWeeks += f.weeks.filter(w => isWeekAssigned(w)).length;
      });
    });
  });
  
  projectList.push('');
  projectList.push(`• Infraestrutura: ${infraCount} tarefas, ${infraWeeks} semanas (${infraWeeks * HOURS_PER_WEEK}h)`);
  
  slide.addText(projectList.join('\n'), {
    x: 0.5, y: 1.2, w: 9, h: 4.2,
    fontSize: 16, bullet: false, valign: 'top'
  });
}

// Slides individuais por projeto
function addProjectSlides(pptx: pptxgen, data: TimelineData) {
  (data.projects || []).forEach(project => {
    const slide = pptx.addSlide();
    slide.addText(project.name, { x: 0.5, y: 0.3, fontSize: 28, bold: true });
    
    const tableData = [
      [
        { text: 'Fase', options: { bold: true, fill: '1F2937', color: 'FFFFFF' } },
        { text: 'Feature', options: { bold: true, fill: '1F2937', color: 'FFFFFF' } },
        { text: 'Categoria', options: { bold: true, fill: '1F2937', color: 'FFFFFF' } },
        { text: 'Pessoas', options: { bold: true, fill: '1F2937', color: 'FFFFFF' } },
        { text: 'Semanas', options: { bold: true, fill: '1F2937', color: 'FFFFFF', align: 'center' } },
        { text: 'Horas', options: { bold: true, fill: '1F2937', color: 'FFFFFF', align: 'center' } }
      ]
    ];
    
    project.phases.forEach(phase => {
      phase.features.forEach(feature => {
        const assignedWeeks = feature.weeks.filter(w => isWeekAssigned(w));
        const categories = new Set(assignedWeeks.map(w => w.category).filter(Boolean));
        const people = new Set<string>();
        assignedWeeks.forEach(w => {
          (w.people || []).forEach(p => people.add(p));
        });
        
        const catLabel = Array.from(categories).map(c => 
          c ? CATEGORIES[c as keyof typeof CATEGORIES].label : ''
        ).join(', ');
        
        const peopleLabel = Array.from(people).map(p => 
          PEOPLE[p as keyof typeof PEOPLE]?.name || p
        ).join(', ');
        
        tableData.push([
          { text: phase.name, options: { fontSize: 10 } },
          { text: feature.name, options: { fontSize: 10 } },
          { text: catLabel || '-', options: { fontSize: 9 } },
          { text: peopleLabel || '-', options: { fontSize: 9 } },
          { text: assignedWeeks.length.toString(), options: { align: 'center', fontSize: 10 } },
          { text: (assignedWeeks.length * HOURS_PER_WEEK).toString() + 'h', options: { align: 'center', fontSize: 10 } }
        ]);
      });
    });
    
    slide.addTable(tableData, {
      x: 0.5, y: 1, w: 9, h: 4.5,
      fontSize: 10, border: { pt: 1, color: 'E5E7EB' },
      autoPage: true, autoPageRepeatHeader: true
    });
  });
}

// Slide de Infraestrutura
function addInfrastructureSlide(pptx: pptxgen, data: TimelineData) {
  if (!data.infrastructure || data.infrastructure.length === 0) return;
  
  const slide = pptx.addSlide();
  slide.addText('Tarefas de Infraestrutura', { x: 0.5, y: 0.3, fontSize: 28, bold: true });
  
  const tableData = [
    [
      { text: 'Tarefa', options: { bold: true, fill: '1F2937', color: 'FFFFFF' } },
      { text: 'Categoria', options: { bold: true, fill: '1F2937', color: 'FFFFFF' } },
      { text: 'Pessoas', options: { bold: true, fill: '1F2937', color: 'FFFFFF' } },
      { text: 'Semanas', options: { bold: true, fill: '1F2937', color: 'FFFFFF', align: 'center' } },
      { text: 'Horas', options: { bold: true, fill: '1F2937', color: 'FFFFFF', align: 'center' } }
    ]
  ];
  
  data.infrastructure.forEach(project => {
    project.phases.forEach(phase => {
      phase.features.forEach(feature => {
        const assignedWeeks = feature.weeks.filter(w => isWeekAssigned(w));
        const categories = new Set(assignedWeeks.map(w => w.category).filter(Boolean));
        const people = new Set<string>();
        assignedWeeks.forEach(w => {
          (w.people || []).forEach(p => people.add(p));
        });
        
        const catLabel = Array.from(categories).map(c => 
          c ? CATEGORIES[c as keyof typeof CATEGORIES].label : ''
        ).join(', ');
        
        const peopleLabel = Array.from(people).map(p => 
          PEOPLE[p as keyof typeof PEOPLE]?.name || p
        ).join(', ');
        
        tableData.push([
          { text: feature.name, options: { fontSize: 10 } },
          { text: catLabel || '-', options: { fontSize: 9 } },
          { text: peopleLabel || '-', options: { fontSize: 9 } },
          { text: assignedWeeks.length.toString(), options: { align: 'center', fontSize: 10 } },
          { text: (assignedWeeks.length * HOURS_PER_WEEK).toString() + 'h', options: { align: 'center', fontSize: 10 } }
        ]);
      });
    });
  });
  
  slide.addTable(tableData, {
    x: 0.5, y: 1, w: 9, h: 4.5,
    fontSize: 10, border: { pt: 1, color: 'E5E7EB' }
  });
}

export function generatePowerPoint(data: TimelineData): pptxgen {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  
  addTitleSlide(pptx);
  addExecutiveSummary(pptx, data);
  addCategoryDistribution(pptx, data);
  addPeopleDistribution(pptx, data);
  addWorkloadAnalysis(pptx, data);
  addProjectsOverview(pptx, data);
  addProjectSlides(pptx, data);
  addInfrastructureSlide(pptx, data);
  
  return pptx;
}

export function generateReport(data: TimelineData): string {
  const categoryStats = getCategoryStats(data);
  const peopleStats = getPeopleStats(data);
  
  const allProjects = [...(data.projects || []), ...(data.infrastructure || [])];
  let totalFeatures = 0;
  let totalWeeks = 0;
  
  allProjects.forEach(project => {
    project.phases.forEach(phase => {
      totalFeatures += phase.features.length;
      phase.features.forEach(feature => {
        totalWeeks += feature.weeks.filter(w => isWeekAssigned(w)).length;
      });
    });
  });
  
  const totalHours = totalWeeks * HOURS_PER_WEEK;
  
  let report = '# Relatório do Cronograma TE 2026\n\n';
  report += `**Gerado em:** ${new Date().toLocaleDateString('pt-BR')}\n\n`;
  report += '## Resumo Executivo\n\n';
  report += `- **Projetos:** ${allProjects.length}\n`;
  report += `- **Features:** ${totalFeatures}\n`;
  report += `- **Semanas Alocadas:** ${totalWeeks}\n`;
  report += `- **Horas Totais:** ${totalHours.toLocaleString('pt-BR')}h (base: ${HOURS_PER_WEEK}h/semana)\n\n`;
  
  report += '## Distribuição por Categoria\n\n';
  categoryStats.forEach(stat => {
    report += `- **${stat.name}:** ${stat.weeks} semanas (${stat.hours.toLocaleString('pt-BR')}h)\n`;
  });
  
  report += '\n## Distribuição por Pessoa\n\n';
  peopleStats.forEach(stat => {
    report += `- **${stat.name}:** ${stat.weeks} semanas (${stat.hours.toLocaleString('pt-BR')}h)\n`;
  });
  
  report += '\n## Projetos\n\n';
  (data.projects || []).forEach(project => {
    const featuresCount = project.phases.reduce((sum, ph) => sum + ph.features.length, 0);
    let weeksCount = 0;
    project.phases.forEach(ph => {
      ph.features.forEach(f => {
        weeksCount += f.weeks.filter(w => isWeekAssigned(w)).length;
      });
    });
    report += `### ${project.name}\n`;
    report += `- Features: ${featuresCount}\n`;
    report += `- Semanas: ${weeksCount} (${weeksCount * HOURS_PER_WEEK}h)\n\n`;
  });
  
  if (data.infrastructure && data.infrastructure.length > 0) {
    report += '## Infraestrutura\n\n';
    let infraWeeks = 0;
    data.infrastructure.forEach(p => {
      p.phases.forEach(ph => {
        ph.features.forEach(f => {
          infraWeeks += f.weeks.filter(w => isWeekAssigned(w)).length;
        });
      });
    });
    report += `- Tarefas: ${data.infrastructure.length}\n`;
    report += `- Semanas: ${infraWeeks} (${infraWeeks * HOURS_PER_WEEK}h)\n`;
  }
  
  return report;
}
