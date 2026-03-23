'use client';

import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { parseCSV } from '@/lib/csvParser';
import { useCronogramaStore } from '@/store/cronogramaStore';

export default function CSVUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setData = useCronogramaStore((state) => state.setData);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = parseCSV(content);
        setData(parsedData);
      } catch (error) {
        console.error('Erro ao processar CSV:', error);
        alert('Erro ao processar o arquivo CSV. Verifique o formato.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="mb-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
      >
        <Upload size={20} />
        Importar CSV
      </button>
    </div>
  );
}
