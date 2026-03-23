'use client';

import { useState } from 'react';
import { FileText, Download, Presentation } from 'lucide-react';
import { useCronogramaStore } from '@/store/cronogramaStore';
import { exportToCSV } from '@/lib/csvParser';

export default function ReportGenerator() {
  const data = useCronogramaStore((state) => state.data);
  const [generating, setGenerating] = useState(false);

  const handleGeneratePowerPoint = async () => {
    if (!data) return;

    setGenerating(true);
    try {
      const { generatePowerPoint } = await import('@/lib/reportGenerator');
      const pptx = generatePowerPoint(data);
      await pptx.writeFile({ fileName: 'Cronograma_Projetos_2026.pptx' });
    } catch (error) {
      console.error('Erro ao gerar PowerPoint:', error);
      alert('Erro ao gerar apresentação');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateMarkdownReport = async () => {
    if (!data) return;

    const { generateReport } = await import('@/lib/reportGenerator');
    const report = generateReport(data);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Relatorio_Cronograma_2026.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!data) return;
    
    const csv = exportToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cronograma_exportado.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Gerar Relatórios</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={handleGeneratePowerPoint}
          disabled={generating}
          className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-orange-500 to-red-500 
                     text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all 
                     transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Presentation size={32} />
          <div className="text-center">
            <div className="font-semibold">Apresentação PowerPoint</div>
            <div className="text-xs opacity-90 mt-1">
              {generating ? 'Gerando...' : 'Gerar slides dos projetos'}
            </div>
          </div>
        </button>

        <button
          onClick={handleGenerateMarkdownReport}
          className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-blue-500 to-purple-500 
                     text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all 
                     transform hover:scale-105"
        >
          <FileText size={32} />
          <div className="text-center">
            <div className="font-semibold">Relatório Markdown</div>
            <div className="text-xs opacity-90 mt-1">Relatório detalhado em MD</div>
          </div>
        </button>

        <button
          onClick={handleExportCSV}
          className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-green-500 to-teal-500 
                     text-white rounded-lg hover:from-green-600 hover:to-teal-600 transition-all 
                     transform hover:scale-105"
        >
          <Download size={32} />
          <div className="text-center">
            <div className="font-semibold">Exportar CSV</div>
            <div className="text-xs opacity-90 mt-1">Baixar cronograma em CSV</div>
          </div>
        </button>
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Estatísticas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.projects.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Projetos</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {data.projects.reduce((sum, p) => sum + p.phases.length, 0)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Fases</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {data.projects.reduce(
                (sum, p) => sum + p.phases.reduce((pSum, phase) => pSum + phase.features.length, 0),
                0
              )}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Features</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.months.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Meses</div>
          </div>
        </div>
      </div>
    </div>
  );
}
