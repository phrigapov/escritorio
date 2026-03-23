'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useCronogramaStore } from '@/store/cronogramaStore';
import { Project, Phase, Feature } from '@/types/cronograma';

export default function ProjectManager() {
  const { data, addProject, deleteProject, setData } = useCronogramaStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    phaseName: '',
    featureName: '',
  });

  const handleResetData = () => {
    if (confirm('⚠️ Isso vai APAGAR TODOS os projetos e dados do cronograma. Tem certeza?')) {
      if (confirm('Última confirmação: Esta ação NÃO pode ser desfeita!')) {
        const emptyData = {
          months: [
            { name: 'Fevereiro', weeks: 4 },
            { name: 'Março', weeks: 4 },
            { name: 'Abril', weeks: 4 },
            { name: 'Maio', weeks: 4 },
            { name: 'Junho', weeks: 4 },
            { name: 'Julho', weeks: 4 },
            { name: 'Agosto', weeks: 4 },
            { name: 'Setembro', weeks: 4 },
            { name: 'Outubro', weeks: 4 },
            { name: 'Novembro', weeks: 4 },
            { name: 'Dezembro', weeks: 4 },
          ],
          projects: [],
        };
        setData(emptyData);
        console.log('✓ Dados resetados');
      }
    }
  };

  const handleAddProject = () => {
    if (!newProject.name || !newProject.phaseName || !newProject.featureName) {
      alert('Preencha todos os campos');
      return;
    }

    const feature: Feature = {
      id: generateId(newProject.featureName),
      name: newProject.featureName,
      weeks: [],
    };

    const phase: Phase = {
      id: generateId(newProject.phaseName),
      name: newProject.phaseName,
      features: [feature],
    };

    const project: Project = {
      id: generateId(newProject.name),
      name: newProject.name,
      phases: [phase],
    };

    addProject(project);
    setNewProject({ name: '', phaseName: '', featureName: '' });
    setShowAddForm(false);
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Gerenciar Projetos</h2>
        <div className="flex gap-2">
          <button
            onClick={handleResetData}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
            title="Resetar todos os dados"
          >
            <X size={20} />
            Resetar Tudo
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
          >
            <Plus size={20} />
            Novo Projeto
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-green-200 dark:border-green-700">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Adicionar Novo Projeto</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome do Projeto
              </label>
              <input
                type="text"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: Sistema de Gestão"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome da Fase
              </label>
              <input
                type="text"
                value={newProject.phaseName}
                onChange={(e) => setNewProject({ ...newProject, phaseName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: Fase 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome da Feature
              </label>
              <input
                type="text"
                value={newProject.featureName}
                onChange={(e) => setNewProject({ ...newProject, featureName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: Login de Usuários"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddProject}
                className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600"
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
        </div>
      )}

      {data && data.projects.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Projetos Existentes:</h3>
          {data.projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <div>
                <div className="font-medium text-gray-800 dark:text-gray-100">{project.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {project.phases.length} fase(s) •{' '}
                  {project.phases.reduce((sum, p) => sum + p.features.length, 0)} feature(s)
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Deseja realmente excluir o projeto "${project.name}"?`)) {
                    deleteProject(project.id);
                  }
                }}
                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                title="Excluir projeto"
              >
                <X size={20} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
