import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), 'public', 'cronograma-inicial.csv');
    
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: 'CSV não encontrado' }, { status: 404 });
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    return NextResponse.json({ csv: csvContent });
  } catch (error) {
    console.error('Erro ao ler CSV inicial:', error);
    return NextResponse.json({ error: 'Erro ao ler CSV' }, { status: 500 });
  }
}
