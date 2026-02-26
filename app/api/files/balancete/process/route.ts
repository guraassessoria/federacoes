import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MESES_MAP: { [key: string]: string } = {
  'jan': 'JAN', 'fev': 'FEV', 'mar': 'MAR', 'abr': 'ABR',
  'mai': 'MAI', 'jun': 'JUN', 'jul': 'JUL', 'ago': 'AGO',
  'set': 'SET', 'out': 'OUT', 'nov': 'NOV', 'dez': 'DEZ',
  'janeiro': 'JAN', 'fevereiro': 'FEV', 'março': 'MAR', 'abril': 'ABR',
  'maio': 'MAI', 'junho': 'JUN', 'julho': 'JUL', 'agosto': 'AGO',
  'setembro': 'SET', 'outubro': 'OUT', 'novembro': 'NOV', 'dezembro': 'DEZ'
};

const MESES_NUM: { [key: number]: string } = {
  1: 'JAN', 2: 'FEV', 3: 'MAR', 4: 'ABR', 5: 'MAI', 6: 'JUN',
  7: 'JUL', 8: 'AGO', 9: 'SET', 10: 'OUT', 11: 'NOV', 12: 'DEZ'
};

// Mapeamento de meses em inglês para português
const MESES_EN_PT: { [key: string]: string } = {
  'jan': 'JAN', 'feb': 'FEV', 'mar': 'MAR', 'apr': 'ABR', 'may': 'MAI', 'jun': 'JUN',
  'jul': 'JUL', 'aug': 'AGO', 'sep': 'SET', 'oct': 'OUT', 'nov': 'NOV', 'dec': 'DEZ'
};

function normalizePeriod(period: string | Date | number): string {
  // Se for uma data (do Excel)
  if (period instanceof Date) {
    const mes = MESES_NUM[period.getMonth() + 1];
    const ano = period.getFullYear().toString().substring(2);
    return `${mes}/${ano}`;
  }
  
  // Se for número (serial date do Excel)
  if (typeof period === 'number') {
    const date = XLSX.SSF.parse_date_code(period);
    const mes = MESES_NUM[date.m];
    const ano = date.y.toString().substring(2);
    return `${mes}/${ano}`;
  }
  
  // Se for string no formato ISO (2024-12-01)
  if (typeof period === 'string' && period.match(/^\d{4}-\d{2}-\d{2}/)) {
    const date = new Date(period);
    const mes = MESES_NUM[date.getMonth() + 1];
    const ano = date.getFullYear().toString().substring(2);
    return `${mes}/${ano}`;
  }
  
  // Se for string no formato Excel inglês (Dec-24, DEC-24)
  if (typeof period === 'string' && period.match(/^[A-Za-z]{3}-\d{2}$/)) {
    const parts = period.toLowerCase().split('-');
    const mesPt = MESES_EN_PT[parts[0]] || parts[0].toUpperCase();
    return `${mesPt}/${parts[1]}`;
  }
  
  // Normaliza "dez/24" -> "DEZ/24", "dezembro/2024" -> "DEZ/24"
  const periodStr = String(period);
  const parts = periodStr.toLowerCase().trim().split('/');
  if (parts.length !== 2) {
    // Tenta formato com hífen
    const dashParts = periodStr.toLowerCase().trim().split('-');
    if (dashParts.length === 2) {
      const mesPt = MESES_EN_PT[dashParts[0]] || MESES_MAP[dashParts[0]] || dashParts[0].toUpperCase().substring(0, 3);
      let ano = dashParts[1];
      if (ano.length === 4) ano = ano.substring(2);
      return `${mesPt}/${ano}`;
    }
    return periodStr.toUpperCase();
  }
  
  const mes = MESES_MAP[parts[0]] || parts[0].toUpperCase().substring(0, 3);
  let ano = parts[1];
  
  // Se ano tem 4 dígitos, pegar só os 2 últimos
  if (ano.length === 4) {
    ano = ano.substring(2);
  }
  
  return `${mes}/${ano}`;
}

// Normaliza nome de coluna removendo acentos e caracteres especiais
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function parseCSVLine(line: string, separator: string = ';'): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function parseDecimal(value: unknown): number {
  // Se já for número, retorna diretamente
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  
  // Se for string vazia ou undefined
  if (!value || (typeof value === 'string' && value.trim() === '')) return 0;
  
  const strValue = String(value).trim();
  
  // Detectar formato: se tem vírgula como separador de milhar (formato americano: 1,234.56)
  // ou se tem ponto como separador de milhar (formato brasileiro: 1.234,56)
  if (strValue.includes(',') && strValue.includes('.')) {
    // Tem ambos - verificar qual é o decimal (último caractere separador)
    const lastComma = strValue.lastIndexOf(',');
    const lastDot = strValue.lastIndexOf('.');
    
    if (lastDot > lastComma) {
      // Formato americano: 1,234.56 - remove vírgulas
      const cleaned = strValue.replace(/,/g, '');
      return parseFloat(cleaned) || 0;
    } else {
      // Formato brasileiro: 1.234,56 - remove pontos e converte vírgula
      const cleaned = strValue.replace(/\./g, '').replace(',', '.');
      return parseFloat(cleaned) || 0;
    }
  } else if (strValue.includes(',')) {
    // Só tem vírgula - pode ser decimal brasileiro ou milhar americano
    // Se tem 3 dígitos após a vírgula, é milhar americano
    const parts = strValue.split(',');
    if (parts.length === 2 && parts[1].length === 3) {
      // Milhar americano: 1,234
      return parseFloat(strValue.replace(',', '')) || 0;
    }
    // Decimal brasileiro: 1234,56
    return parseFloat(strValue.replace(',', '.')) || 0;
  }
  
  // Só tem ponto ou nenhum - formato americano padrão
  return parseFloat(strValue.replace(/,/g, '')) || 0;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, fileId } = body;

    if (!companyId || !fileId) {
      return NextResponse.json(
        { error: "companyId e fileId são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar permissão do usuário na empresa
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: session.user.id,
        companyId,
        role: { in: ["ADMIN", "EDITOR"] },
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!userCompany && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Buscar o arquivo
    const file = await prisma.companyFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }

    if (file.companyId !== companyId) {
      return NextResponse.json({ error: "Arquivo não pertence à empresa" }, { status: 403 });
    }

    // Obter URL do arquivo no S3
    const fileUrl = await getFileUrl(file.cloudStoragePath, false);
    
    // Baixar o arquivo
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Erro ao baixar arquivo do storage" }, { status: 500 });
    }

    // Determinar tipo de arquivo
    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    
    let rows: Record<string, unknown>[] = [];
    let headers: string[] = [];
    
    if (isExcel) {
      // Processar arquivo Excel
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Converter para JSON com raw: true para obter valores numéricos nativos
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][];
      
      if (jsonData.length < 2) {
        return NextResponse.json({ error: "Arquivo Excel vazio ou inválido" }, { status: 400 });
      }
      
      // Primeira linha são os headers
      headers = (jsonData[0] as string[]).map(h => normalizeColumnName(String(h || '')));
      console.log("Headers Excel normalizados:", headers);
      
      // Converter linhas para objetos
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as unknown[];
        if (!row || row.length === 0) continue;
        
        const rowObj: Record<string, unknown> = {};
        headers.forEach((header, idx) => {
          rowObj[header] = row[idx];
        });
        rows.push(rowObj);
      }
    } else {
      // Processar arquivo CSV
      const csvContent = await response.text();
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim());

      if (lines.length < 2) {
        return NextResponse.json({ error: "Arquivo CSV vazio ou inválido" }, { status: 400 });
      }

      // Detectar separador (pode ser ; ou ,)
      const headerLine = lines[0];
      const separator = headerLine.includes(';') ? ';' : ',';
      
      // Parse header
      headers = parseCSVLine(headerLine, separator).map(h => normalizeColumnName(h));
      console.log("Headers CSV normalizados:", headers);
      
      // Processar linhas de dados
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], separator);
        if (cols.length < 4) continue;
        
        const rowObj: Record<string, unknown> = {};
        headers.forEach((header, idx) => {
          rowObj[header] = cols[idx];
        });
        rows.push(rowObj);
      }
    }
    
    // Mapear colunas (flexível para diferentes formatos)
    const colMap: { [key: string]: string } = {};
    
    headers.forEach((h) => {
      // Período (pode vir como "periodo", "peraodo" devido a encoding)
      if (h.includes('periodo') || h.includes('peraodo') || h === 'periodo') {
        colMap.period = h;
      }
      // Número da Conta - deve ter "numero"/"namero" mas NÃO "descricao"/"descriaao"
      else if ((h.includes('numero') || h.includes('namero')) && !h.includes('descricao') && !h.includes('descriaao')) {
        colMap.accountNumber = h;
      }
      // Descrição da Conta
      else if (h.includes('descricao') || h.includes('descriaao')) {
        colMap.accountDescription = h;
      }
      // Saldo Anterior
      else if (h.includes('saldo') && h.includes('anterior')) {
        colMap.previousBalance = h;
      }
      // Débito
      else if (h.includes('debito') || h.includes('dabito')) {
        colMap.debit = h;
      }
      // Crédito
      else if (h.includes('credito') || h.includes('cradito')) {
        colMap.credit = h;
      }
      // Saldo Final
      else if (h.includes('saldo') && h.includes('final')) {
        colMap.finalBalance = h;
      }
      // Natureza
      else if (h.includes('natureza')) {
        colMap.accountNature = h;
      }
    });
    
    console.log("Column mapping:", colMap);

    // Verificar se encontramos as colunas necessárias
    const requiredCols = ['period', 'accountNumber', 'accountDescription', 'finalBalance'];
    const missingCols = requiredCols.filter(col => colMap[col] === undefined);
    
    if (missingCols.length > 0) {
      return NextResponse.json(
        { error: `Colunas obrigatórias não encontradas: ${missingCols.join(', ')}. Colunas detectadas: ${headers.join(', ')}` },
        { status: 400 }
      );
    }

    // Processar linhas de dados
    const dataToInsert: {
      companyId: string;
      period: string;
      accountNumber: string;
      accountDescription: string;
      previousBalance: number;
      debit: number;
      credit: number;
      finalBalance: number;
      accountNature: string;
    }[] = [];

    const periodsFound = new Set<string>();

    for (const row of rows) {
      const rawPeriod = row[colMap.period];
      if (!rawPeriod) continue;
      
      const period = normalizePeriod(rawPeriod as string | Date | number);
      periodsFound.add(period);
      
      const accountNumber = String(row[colMap.accountNumber] || '');
      const accountDescription = String(row[colMap.accountDescription] || '');
      
      if (!accountNumber) continue;
      
      dataToInsert.push({
        companyId,
        period,
        accountNumber: accountNumber.trim(),
        accountDescription: accountDescription.trim(),
        previousBalance: colMap.previousBalance ? parseDecimal(row[colMap.previousBalance]) : 0,
        debit: colMap.debit ? parseDecimal(row[colMap.debit]) : 0,
        credit: colMap.credit ? parseDecimal(row[colMap.credit]) : 0,
        finalBalance: parseDecimal(row[colMap.finalBalance]),
        accountNature: colMap.accountNature ? String(row[colMap.accountNature] || 'D').trim() : 'D',
      });
    }

    if (dataToInsert.length === 0) {
      return NextResponse.json({ error: "Nenhum dado válido encontrado no arquivo" }, { status: 400 });
    }

    // Deletar dados antigos dos períodos encontrados
    await prisma.balanceteData.deleteMany({
      where: {
        companyId,
        period: { in: Array.from(periodsFound) },
      },
    });

    // Inserir novos dados em lotes
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < dataToInsert.length; i += batchSize) {
      const batch = dataToInsert.slice(i, i + batchSize);
      await prisma.balanceteData.createMany({
        data: batch,
      });
      insertedCount += batch.length;
    }

    // Atualizar período do arquivo se necessário
    const periods = Array.from(periodsFound).sort();
    const mainPeriod = periods[periods.length - 1]; // Usar o período mais recente
    
    await prisma.companyFile.update({
      where: { id: fileId },
      data: { period: mainPeriod },
    });

    return NextResponse.json({
      success: true,
      message: `Processamento concluído com sucesso`,
      insertedRecords: insertedCount,
      periods: periods,
      mainPeriod,
    });
  } catch (error) {
    console.error("Error processing balancete:", error);
    return NextResponse.json(
      { error: `Erro ao processar balancete: ${error instanceof Error ? error.message : 'Erro desconhecido'}` },
      { status: 500 }
    );
  }
}
