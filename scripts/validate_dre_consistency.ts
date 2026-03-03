import 'dotenv/config';
import { prisma } from '@/lib/db';
import { parsePeriod } from '@/lib/services/financialProcessing';
import { processarDadosFinanceiros, ContaComValor, DeParaRecord } from '@/lib/services/estruturaMapping';
import { ordenarArvoreDreReceitaBrutaPrimeiro } from '@/lib/services/drePresentation';

type FinancialApiData = {
  estruturaDRE?: ContaComValor[];
};

type CompanyData = {
  id: string;
  name: string;
  data: FinancialApiData;
};

type LinhaComparativa = {
  codigo: string;
  descricao: string;
  nivel: number;
  valores: Record<string, number>;
};

function flattenContas(contas: ContaComValor[]): ContaComValor[] {
  const result: ContaComValor[] = [];
  const walk = (rows: ContaComValor[]) => {
    rows.forEach((row) => {
      result.push(row);
      if (row.children?.length) walk(row.children);
    });
  };
  walk(contas || []);
  return result;
}

async function getEstruturaDREAnual(companyId: string, year: string): Promise<ContaComValor[]> {
  const periods = await prisma.balancete.findMany({
    where: { companyId },
    select: { period: true },
    distinct: ['period'],
  });

  const uniquePeriods = [...new Set(periods.map((p) => p.period))];
  const filteredPeriods = uniquePeriods.filter((period) => {
    const parsed = parsePeriod(period);
    return parsed && parsed.year === year;
  });

  if (filteredPeriods.length === 0) return [];

  const deParaRows = await prisma.deParaMapping.findMany({
    where: { companyId },
    select: {
      contaFederacao: true,
      padraoBP: true,
      padraoDRE: true,
      padraoDFC: true,
      padraoDMPL: true,
    },
  });

  const deParaRecords: DeParaRecord[] = deParaRows.map((r) => ({
    contaFederacao: r.contaFederacao,
    padraoBP: r.padraoBP,
    padraoDRE: r.padraoDRE,
    padraoDFC: r.padraoDFC,
    padraoDMPL: r.padraoDMPL,
  }));

  const allBalancetes = await prisma.balancete.findMany({
    where: {
      companyId,
      period: { in: filteredPeriods },
    },
  });

  if (allBalancetes.length === 0) return [];

  const processado = await processarDadosFinanceiros(allBalancetes, deParaRecords);
  return ordenarArvoreDreReceitaBrutaPrimeiro(processado.dre);
}

function buildComparativeRowsDre(
  selectedCompanies: CompanyData[],
  maxNivel: number = 4,
  onlyVisible: boolean = true
): LinhaComparativa[] {
  if (selectedCompanies.length === 0) return [];

  const normalizeCode = (code: string | null | undefined) =>
    (code || '').toString().trim().replace(',', '.');
  const normalizeText = (text: string | null | undefined) =>
    (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const templateCompany = selectedCompanies.find((company) => (company.data.estruturaDRE || []).length > 0);
  const templateTree = templateCompany?.data.estruturaDRE || [];
  if (templateTree.length === 0) return [];

  const estruturaPorEmpresa = new Map<string, ContaComValor[]>();
  const flatPorEmpresa = new Map<string, ContaComValor[]>();

  selectedCompanies.forEach((company) => {
    const roots = company.data.estruturaDRE || [];
    estruturaPorEmpresa.set(company.id, roots);
    flatPorEmpresa.set(company.id, flattenContas(roots));
  });

  const resolveConta = (
    companyId: string,
    nodeTemplate: ContaComValor,
    parentResolved?: ContaComValor
  ): ContaComValor | undefined => {
    const codigo = normalizeCode(nodeTemplate.codigo);
    const descricao = normalizeText(nodeTemplate.descricao);

    if (parentResolved?.children?.length) {
      const byCodeInParent = parentResolved.children.find(
        (child) => normalizeCode(child.codigo) === codigo
      );
      if (byCodeInParent) return byCodeInParent;

      const byDescInParent = parentResolved.children.find(
        (child) => normalizeText(child.descricao) === descricao
      );
      if (byDescInParent) return byDescInParent;
    }

    const roots = estruturaPorEmpresa.get(companyId) || [];
    if (!parentResolved) {
      const byCodeAtRoot = roots.find((root) => normalizeCode(root.codigo) === codigo);
      if (byCodeAtRoot) return byCodeAtRoot;

      const byDescAtRoot = roots.find((root) => normalizeText(root.descricao) === descricao);
      if (byDescAtRoot) return byDescAtRoot;
    }

    const flat = flatPorEmpresa.get(companyId) || [];
    const expectedNivel = nodeTemplate.nivelVisualizacao || nodeTemplate.nivel || 1;

    const codeMatches = flat.filter((conta) => normalizeCode(conta.codigo) === codigo);
    if (codeMatches.length === 1) return codeMatches[0];
    if (codeMatches.length > 1) {
      const byLevel = codeMatches.find(
        (conta) => (conta.nivelVisualizacao || conta.nivel || 1) === expectedNivel
      );
      if (byLevel) return byLevel;

      const byDesc = codeMatches.find(
        (conta) => normalizeText(conta.descricao) === descricao
      );
      if (byDesc) return byDesc;

      return codeMatches[0];
    }

    const descMatches = flat.filter(
      (conta) => normalizeText(conta.descricao) === descricao
    );
    if (descMatches.length === 1) return descMatches[0];
    if (descMatches.length > 1) {
      const byLevel = descMatches.find(
        (conta) => (conta.nivelVisualizacao || conta.nivel || 1) === expectedNivel
      );
      if (byLevel) return byLevel;
      return descMatches[0];
    }

    return undefined;
  };

  const walkTemplate = (
    nodes: ContaComValor[],
    parentResolvedByCompany?: Record<string, ContaComValor | undefined>
  ): LinhaComparativa[] => {
    const rows: LinhaComparativa[] = [];

    nodes.forEach((node) => {
      const nivel = node.nivelVisualizacao || node.nivel || 1;
      const resolvedByCompany = Object.fromEntries(
        selectedCompanies.map((company) => [
          company.id,
          resolveConta(company.id, node, parentResolvedByCompany?.[company.id]),
        ])
      ) as Record<string, ContaComValor | undefined>;

      const childRows = node.children?.length
        ? walkTemplate(node.children, resolvedByCompany)
        : [];

      const ownHasValue = selectedCompanies.some(
        (company) => Math.abs(resolvedByCompany[company.id]?.valor || 0) > 0
      );
      const visible = ownHasValue || childRows.length > 0;

      if (nivel <= maxNivel && (!onlyVisible || visible)) {
        const valores: Record<string, number> = {};
        selectedCompanies.forEach((company) => {
          valores[company.id] = resolvedByCompany[company.id]?.valor || 0;
        });

        rows.push({
          codigo: node.codigo,
          descricao: node.descricao,
          nivel,
          valores,
        });
      }

      rows.push(...childRows);
    });

    return rows;
  };

  return walkTemplate(templateTree);
}

function buildDemonstracaoRows(estrutura: ContaComValor[], maxNivel: number = 4): Array<{ codigo: string; descricao: string; nivel: number; valor: number }> {
  const rows: Array<{ codigo: string; descricao: string; nivel: number; valor: number }> = [];

  const hasValueRecursive = (node: ContaComValor): boolean => {
    if (Math.abs(node.valor || 0) > 0) return true;
    return (node.children || []).some((child) => hasValueRecursive(child));
  };

  const walk = (nodes: ContaComValor[]) => {
    nodes.forEach((node) => {
      const nivel = node.nivelVisualizacao || node.nivel || 1;
      const visible = hasValueRecursive(node);
      if (nivel <= maxNivel && visible) {
        rows.push({
          codigo: node.codigo,
          descricao: node.descricao,
          nivel,
          valor: node.valor || 0,
        });
      }
      if (node.children?.length) walk(node.children);
    });
  };

  walk(estrutura);
  return rows;
}

async function main() {
  const year = process.env.VALIDATE_YEAR || '2025';
  const targetNames = (process.env.VALIDATE_COMPANIES || 'Mineira,Piauí')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const companies = await prisma.company.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const selected = companies.filter((c) => {
    const n = c.name.toLowerCase();
    return targetNames.some((t) => n.includes(t));
  }).slice(0, 5);

  if (selected.length < 2) {
    console.log('❌ Não foi possível selecionar ao menos 2 empresas para validação.');
    console.log('Defina VALIDATE_COMPANIES com partes do nome (ex: "Mineira,Piauí").');
    return;
  }

  const companyData: CompanyData[] = [];
  for (const company of selected) {
    const estruturaDRE = await getEstruturaDREAnual(company.id, year);
    companyData.push({
      id: company.id,
      name: company.name,
      data: { estruturaDRE },
    });
  }

  console.log(`\n=== VALIDAÇÃO DRE DEMONSTRAÇÕES vs COMPARATIVO (${year}) ===`);
  console.log(`Empresas: ${companyData.map((c) => c.name).join(' | ')}`);

  // teste principal: quando a empresa é a primeira (template), coluna dela deve bater 100% com Demonstrações
  for (const template of companyData) {
    const reordered = [template, ...companyData.filter((c) => c.id !== template.id)];
    const comparativeRows = buildComparativeRowsDre(reordered, 4, true);
    const demoRows = buildDemonstracaoRows(template.data.estruturaDRE || [], 4);

    const compMap = new Map<string, number>();
    comparativeRows.forEach((r) => {
      compMap.set(`${r.codigo}|${r.descricao}|${r.nivel}`, r.valores[template.id] || 0);
    });

    const mismatches: Array<{ key: string; demo: number; comp: number }> = [];
    demoRows.forEach((r) => {
      const key = `${r.codigo}|${r.descricao}|${r.nivel}`;
      const compValue = compMap.get(key) ?? 0;
      if (Math.abs((r.valor || 0) - compValue) > 0.0001) {
        mismatches.push({ key, demo: r.valor || 0, comp: compValue });
      }
    });

    const level2plus = mismatches.filter((m) => {
      const nivel = Number(m.key.split('|')[2] || 0);
      return nivel >= 2;
    });

    console.log(`\n[Template=${template.name}]`);
    console.log(`- Linhas Demonstrações: ${demoRows.length}`);
    console.log(`- Linhas Comparativo:   ${comparativeRows.length}`);
    console.log(`- Divergências totais:  ${mismatches.length}`);
    console.log(`- Divergências nível>=2:${level2plus.length}`);

    if (mismatches.length > 0) {
      console.log('- Primeiras divergências:');
      mismatches.slice(0, 12).forEach((m) => {
        const [codigo, descricao, nivel] = m.key.split('|');
        console.log(`  • ${codigo} | N${nivel} | ${descricao} => demo=${m.demo} comp=${m.comp}`);
      });
    }
  }
}

main()
  .catch((error) => {
    console.error('Erro na validação:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
