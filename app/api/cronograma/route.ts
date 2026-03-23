import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'cronograma.json');

// Dados padrão quando o sistema é inicializado pela primeira vez
const DEFAULT_DATA = {
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

// Garantir que a pasta data existe
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Criar arquivo com dados padrão se não existir
function ensureDataFile() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
    console.log('✓ Arquivo cronograma.json criado com dados padrão');
  }
}

export async function GET() {
  try {
    ensureDataFile();
    
    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    
    // O arquivo pode ter a estrutura { months: [], projects: [] } 
    // ou { data: { months: [], projects: [] } }
    // Sempre retornar na estrutura { data: ... }
    if (jsonData.projects && jsonData.months) {
      // Arquivo tem estrutura direta
      return NextResponse.json({ data: jsonData });
    } else if (jsonData.data) {
      // Arquivo já tem a estrutura { data: ... }
      return NextResponse.json(jsonData);
    }
    
    // Se por algum motivo o arquivo estiver vazio, retornar dados padrão
    return NextResponse.json({ data: DEFAULT_DATA });
  } catch (error) {
    console.error('Erro ao ler dados:', error);
    // Em caso de erro, retornar dados padrão
    return NextResponse.json({ data: DEFAULT_DATA });
  }
}

export async function POST(request: Request) {
  try {
    ensureDataFile();
    const body = await request.json();
    
    // Salvar apenas a estrutura de dados, sem o wrapper { data: ... }
    // já que o setData recebe TimelineData diretamente
    fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2), 'utf-8');
    console.log('✓ Dados salvos em cronograma.json');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    return NextResponse.json({ error: 'Erro ao salvar dados' }, { status: 500 });
  }
}
