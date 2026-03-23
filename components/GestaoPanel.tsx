'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DataInitializer from './gestao/DataInitializer'
import TimelineView from './gestao/TimelineView'
import InfrastructureView from './gestao/InfrastructureView'
import GitHubTasksView from './gestao/GitHubTasksView'
import FeatureEditor from './gestao/FeatureEditor'
import ReportGenerator from './gestao/ReportGenerator'
import ProjectManager from './gestao/ProjectManager'

interface GestaoPanelProps {
  onClose: () => void
}

export default function GestaoPanel({ onClose }: GestaoPanelProps) {
  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        <span className="font-semibold text-sm">Gestão</span>
        <Button variant="ghost" size="xs" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <DataInitializer>
          <Tabs defaultValue="timeline" className="flex flex-col h-full">
            <div className="border-b border-border px-4 shrink-0">
              <TabsList className="h-9 mt-2 mb-0">
                <TabsTrigger value="timeline" className="text-xs">Cronograma</TabsTrigger>
                <TabsTrigger value="infra" className="text-xs">Infra</TabsTrigger>
                <TabsTrigger value="github" className="text-xs">Issues GitHub</TabsTrigger>
                <TabsTrigger value="features" className="text-xs">Features</TabsTrigger>
                <TabsTrigger value="projects" className="text-xs">Projetos</TabsTrigger>
                <TabsTrigger value="reports" className="text-xs">Relatórios</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <TabsContent value="timeline" className="mt-0 h-full">
                <TimelineView />
              </TabsContent>
              <TabsContent value="infra" className="mt-0 h-full">
                <InfrastructureView />
              </TabsContent>
              <TabsContent value="github" className="mt-0 h-full">
                <GitHubTasksView />
              </TabsContent>
              <TabsContent value="features" className="mt-0 h-full">
                <FeatureEditor />
              </TabsContent>
              <TabsContent value="projects" className="mt-0 h-full">
                <ProjectManager />
              </TabsContent>
              <TabsContent value="reports" className="mt-0 h-full">
                <ReportGenerator />
              </TabsContent>
            </div>
          </Tabs>
        </DataInitializer>
      </div>
    </div>
  )
}
