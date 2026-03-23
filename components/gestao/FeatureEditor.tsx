'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { useCronogramaStore } from '@/store/cronogramaStore';
import { Feature, WeekAssignment, MONTHS } from '@/types/cronograma';

export default function FeatureEditor() {
  const { data, addFeature, updateFeature, deleteFeature } = useCronogramaStore();
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedPhase, setSelectedPhase] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFeature, setEditingFeature] = useState<string | null>(null);
  const [newFeature, setNewFeature] = useState({
    name: '',
    responsible: '',
    startMonth: '',
    endMonth: '',
  });

  const selectedProjectData = data?.projects.find((p) => p.id === selectedProject);
  const selectedPhaseData = selectedProjectData?.phases.find((p) => p.id === selectedPhase);

  const handleAddFeature = () => {
    if (!newFeature.name || !newFeature.responsible || !selectedProject || !selectedPhase) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const startMonthIndex = MONTHS.indexOf(newFeature.startMonth);
    const endMonthIndex = MONTHS.indexOf(newFeature.endMonth);

    if (startMonthIndex === -1 || endMonthIndex === -1 || startMonthIndex > endMonthIndex) {
      alert('Período inválido');
      return;
    }

    const weeks: WeekAssignment[] = [];
    for (let i = startMonthIndex; i <= endMonthIndex; i++) {
      const monthWeeks = data?.months.find((m) => m.name === MONTHS[i])?.weeks || 4;
      for (let week = 1; week <= monthWeeks; week++) {
        weeks.push({
          month: MONTHS[i],
          weekNumber: week,
          responsible: newFeature.responsible,
          status: 'planned',
        });
      }
    }

    const feature: Feature = {
      id: generateId(newFeature.name),
      name: newFeature.name,
      weeks,
    };

    addFeature(selectedProject, selectedPhase, feature);
    setNewFeature({ name: '', responsible: '', startMonth: '', endMonth: '' });
    setShowAddForm(false);
  };

  const handleDeleteFeature = (featureId: string, featureName: string) => {
    if (confirm(`Deseja realmente excluir a feature "${featureName}"?`)) {
      deleteFeature(selectedProject, selectedPhase, featureId);
    }
  };

  function generateId(name: string): string {
    return (
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now()
    );
  }

  if (!data) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Gerenciar Features</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Selecione o Projeto
          </label>
          <select
            value={selectedProject}
            onChange={(e) => {
              setSelectedProject(e.target.value);
              setSelectedPhase('');
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Selecione --</option>
            {data.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {selectedProject && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Selecione a Fase
            </label>
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Selecione --</option>
              {selectedProjectData?.phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedPhase && (
        <>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 mb-4"
          >
            <Plus size={20} />
            Nova Feature
          </button>

          {showAddForm && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border-2 border-blue-200 dark:border-blue-700">
              <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Adicionar Nova Feature</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome da Feature *
                  </label>
                  <input
                    type="text"
                    value={newFeature.name}
                    onChange={(e) => setNewFeature({ ...newFeature, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Ex: Tela de Login"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Responsável *
                  </label>
                  <input
                    type="text"
                    value={newFeature.responsible}
                    onChange={(e) => setNewFeature({ ...newFeature, responsible: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Ex: dev, Jonatas, guga"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mês Inicial *
                  </label>
                  <select
                    value={newFeature.startMonth}
                    onChange={(e) => setNewFeature({ ...newFeature, startMonth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">-- Selecione --</option>
                    {MONTHS.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mês Final *
                  </label>
                  <select
                    value={newFeature.endMonth}
                    onChange={(e) => setNewFeature({ ...newFeature, endMonth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">-- Selecione --</option>
                    {MONTHS.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddFeature}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
                >
                  Adicionar
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Features de {selectedPhaseData?.name}:
            </h3>
            {selectedPhaseData?.features.map((feature) => (
              <div
                key={feature.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-800 dark:text-gray-100">{feature.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {feature.weeks.length > 0 && (
                      <>
                        {feature.weeks[0].responsible} •{' '}
                        {[...new Set(feature.weeks.map((w) => w.month))].join(' - ')}
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteFeature(feature.id, feature.name)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full"
                  title="Excluir feature"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {selectedPhaseData?.features.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-sm italic">Nenhuma feature cadastrada</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
