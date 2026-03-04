'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Columns3, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useDashboard } from '@/lib/contexts/DashboardContext';
import { API_ENDPOINTS } from '@/lib/constants';
import { formatCurrency } from '@/lib/data';
import { ordenarDreReceitaBrutaPrimeiro } from '@/lib/services/drePresentation';

interface CompanyAccess {
  id: string;
  name: string;
  cnpj: string | null;
  role: string;
}

interface ContaComValor {
  codigo: string;
  descricao: string;
  codigoSuperior: string | null;
  nivel: number;
  nivelVisualizacao: number;
  valor: number;
  children?: ContaComValor[];
}

interface FinancialApiData {
  estruturaBP?: ContaComValor[];
  estruturaDRE?: ContaComValor[];
  indices?: {
    liquidez?: Record<string, number>;
    rentabilidade?: Record<string, number>;
    endividamento?: Record<string, number>;
    atividade?: Record<string, number>;
  };
}

interface LinhaComparativa {
  codigo: string;
  descricao: string;
  nivel: number;
  isSintetica?: boolean;
  valores: Record<string, number>;
}

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

export default function ComparativoPage() {
  const { data: session } = useSession();
  const { selectedYear, selectedMonth, viewMode } = useDashboard();

  const [companies, setCompanies] = useState<CompanyAccess[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [comparativeData, setComparativeData] = useState<Record<string, FinancialApiData>>({});
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const isAllowedRole = session?.user?.role === 'ADMIN' || session?.user?.role === 'GESTOR';

  useEffect(() => {
    const fetchCompanies = async () => {
      setLoadingCompanies(true);
      try {
        const response = await fetch(API_ENDPOINTS.USER_COMPANIES);
        if (!response.ok) return;
        const payload = await response.json();
        const rows: CompanyAccess[] = payload.companies || [];
        setCompanies(rows);
        setSelectedCompanyIds(rows.map((c) => c.id));
      } catch (error) {
        console.error('Erro ao buscar empresas para comparativo:', error);
      } finally {
        setLoadingCompanies(false);
      }
    };

    fetchCompanies();
  }, []);

  const fetchComparativeData = useCallback(async () => {
    if (selectedCompanyIds.length === 0) {
      setComparativeData({});
      return;
    }

    setLoadingData(true);
    try {
      const results = await Promise.all(
        selectedCompanyIds.map(async (companyId) => {
          const params = new URLSearchParams({
            companyId,
            viewMode,
            year: selectedYear,
          });
          if (viewMode === 'mensal') {
            params.set('month', selectedMonth);
          }

          const response = await fetch(`${API_ENDPOINTS.FINANCIAL_DATA}?${params.toString()}`);
          if (!response.ok) return [companyId, null] as const;

          const result = await response.json();
          if (!result?.success || !result?.data) return [companyId, null] as const;
          return [companyId, result.data as FinancialApiData] as const;
        })
      );

      const mapped: Record<string, FinancialApiData> = {};
      results.forEach(([companyId, data]) => {
        if (data) mapped[companyId] = data;
      });
      setComparativeData(mapped);
    } catch (error) {
      console.error('Erro ao buscar dados comparativos:', error);
    } finally {
      setLoadingData(false);
    }
  }, [selectedCompanyIds, selectedYear, selectedMonth, viewMode]);

  useEffect(() => {
    fetchComparativeData();
  }, [fetchComparativeData]);

  const selectedCompanies = useMemo(
    () => companies.filter((company) => selectedCompanyIds.includes(company.id)),
    [companies, selectedCompanyIds]
  );

  const buildComparativeRows = useCallback(
    (type: 'bp' | 'dre', maxNivel: number = 4, onlyVisible: boolean = true): LinhaComparativa[] => {
      if (selectedCompanies.length === 0) return [];

      const getEstrutura = (companyId: string) =>
        type === 'bp' ? comparativeData[companyId]?.estruturaBP || [] : comparativeData[companyId]?.estruturaDRE || [];

      const estruturasDisponiveis = selectedCompanies
        .map((company) => getEstrutura(company.id))
        .filter((estrutura) => estrutura.length > 0);

      const templateTree =
        estruturasDisponiveis
          .slice()
          .sort((a, b) => flattenContas(b).length - flattenContas(a).length)[0] || [];
      if (templateTree.length === 0) return [];

      if (type === 'dre') {
        const normalizeCode = (code: string | null | undefined) =>
          (code || '').toString().trim().replace(',', '.');
        const normalizeText = (text: string | null | undefined) =>
          (text || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

        const estruturaPorEmpresa = new Map<string, ContaComValor[]>();
        const flatPorEmpresa = new Map<string, ContaComValor[]>();

        selectedCompanies.forEach((company) => {
          const roots = getEstrutura(company.id) || [];
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
            const codigoEstrutura = normalizeCode(node.codigo);
            const descricaoEstrutura = (node.descricao || '').trim();

            if (nivel <= maxNivel && (!onlyVisible || visible)) {
              const valores: Record<string, number> = {};
              selectedCompanies.forEach((company) => {
                valores[company.id] = resolvedByCompany[company.id]?.valor || 0;
              });

              rows.push({
                codigo: codigoEstrutura,
                descricao: descricaoEstrutura,
                nivel,
                isSintetica: !!node.children?.length,
                valores,
              });
            }

            rows.push(...childRows);
          });

          return rows;
        };

        const rows = walkTemplate(templateTree);
        return ordenarDreReceitaBrutaPrimeiro(rows);
      }

      const lookupByCompany = new Map<string, Map<string, ContaComValor>>();
      selectedCompanies.forEach((company) => {
        const map = new Map<string, ContaComValor>();
        flattenContas(getEstrutura(company.id)).forEach((conta) => {
          map.set(conta.codigo, conta);
        });
        lookupByCompany.set(company.id, map);
      });

      const hasValueRecursive = (node: ContaComValor): boolean => {
        const hasOwnValue = selectedCompanies.some((company) => {
          const row = lookupByCompany.get(company.id)?.get(node.codigo);
          return Math.abs(row?.valor || 0) > 0;
        });
        if (hasOwnValue) return true;
        return (node.children || []).some((child) => hasValueRecursive(child));
      };

      const rows: LinhaComparativa[] = [];

      const walk = (nodes: ContaComValor[], fallbackNivel: number = 1) => {
        nodes.forEach((node) => {
          const nivel = node.nivelVisualizacao || node.nivel || fallbackNivel;
          const visible = hasValueRecursive(node);

          if ((!onlyVisible || visible) && nivel <= maxNivel) {
            const valores: Record<string, number> = {};
            selectedCompanies.forEach((company) => {
              const row = lookupByCompany.get(company.id)?.get(node.codigo);
              valores[company.id] = row?.valor || 0;
            });

            rows.push({
              codigo: node.codigo,
              descricao: node.descricao,
              nivel,
              isSintetica: !!node.children?.length,
              valores,
            });
          }

          if (node.children?.length) {
            walk(node.children, nivel + 1);
          }
        });
      };

      walk(templateTree);
      return rows;
    },
    [comparativeData, selectedCompanies]
  );

  const bpRows = useMemo(() => buildComparativeRows('bp', 3), [buildComparativeRows]);
  const dreRows = useMemo(() => buildComparativeRows('dre', 4), [buildComparativeRows]);

  const indicesRows = useMemo(() => {
    const labels: Array<{ key: string; label: string; group: 'liquidez' | 'rentabilidade' | 'endividamento' | 'atividade' }> = [
      { key: 'corrente', label: 'Liquidez Corrente', group: 'liquidez' },
      { key: 'seca', label: 'Liquidez Seca', group: 'liquidez' },
      { key: 'imediata', label: 'Liquidez Imediata', group: 'liquidez' },
      { key: 'geral', label: 'Liquidez Geral', group: 'liquidez' },
      { key: 'margemBruta', label: 'Margem Bruta (%)', group: 'rentabilidade' },
      { key: 'margemOperacional', label: 'Margem Operacional (%)', group: 'rentabilidade' },
      { key: 'margemLiquida', label: 'Margem Líquida (%)', group: 'rentabilidade' },
      { key: 'roa', label: 'ROA (%)', group: 'rentabilidade' },
      { key: 'roe', label: 'ROE (%)', group: 'rentabilidade' },
      { key: 'endividamentoGeral', label: 'Endividamento Geral (%)', group: 'endividamento' },
      { key: 'composicaoEndividamento', label: 'Composição Endividamento (%)', group: 'endividamento' },
      { key: 'grauAlavancagem', label: 'Grau de Alavancagem', group: 'endividamento' },
      { key: 'giroAtivo', label: 'Giro do Ativo', group: 'atividade' },
      { key: 'prazoMedioRecebimento', label: 'Prazo Médio de Recebimento', group: 'atividade' },
      { key: 'prazoMedioPagamento', label: 'Prazo Médio de Pagamento', group: 'atividade' },
    ];

    return labels.map((item) => ({
      ...item,
      valores: Object.fromEntries(
        selectedCompanies.map((company) => [
          company.id,
          comparativeData[company.id]?.indices?.[item.group]?.[item.key] ?? null,
        ])
      ) as Record<string, number | null>,
    }));
  }, [comparativeData, selectedCompanies]);

  const toggleCompany = (companyId: string) => {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    );
  };

  const handleExportPdf = async () => {
    if (selectedCompanyIds.length < 2) {
      alert('Selecione pelo menos 2 empresas para exportar o comparativo em PDF.');
      return;
    }

    setGeneratingPdf(true);
    try {
      const response = await fetch(API_ENDPOINTS.GENERATE_COMPARATIVE_PDF, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear, companyIds: selectedCompanyIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar PDF comparativo');
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/pdf')) {
        throw new Error('O serviço não retornou um PDF válido');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `comparativo_${selectedYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar PDF comparativo:', error);
      alert(error instanceof Error ? error.message : 'Erro ao exportar PDF comparativo');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (selectedCompanies.length === 0) return;

    setExportingExcel(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      const companyHeaders = selectedCompanies.map((company) => company.name);
      const bpRowsForExcel = buildComparativeRows('bp', Number.MAX_SAFE_INTEGER, false);
      const dreRowsForExcel = buildComparativeRows('dre', Number.MAX_SAFE_INTEGER, false);
      const formatDescricao = (descricao: string, nivel: number) => `${'  '.repeat(Math.max(0, nivel - 1))}${descricao}`;
      const normalizeCode = (codigo: string) => (codigo || '').toString().trim().replace(',', '.');

      const bpSheet = [
        ['Código', 'Nível', 'Conta', ...companyHeaders],
        ...bpRowsForExcel.map((row) => [
          normalizeCode(row.codigo),
          row.nivel,
          formatDescricao(row.descricao, row.nivel),
          ...selectedCompanies.map((company) => row.valores[company.id] || 0),
        ]),
      ];

      const dreSheet = [
        ['Código', 'Nível', 'Conta', ...companyHeaders],
        ...dreRowsForExcel.map((row) => [
          normalizeCode(row.codigo),
          row.nivel,
          formatDescricao(row.descricao, row.nivel),
          ...selectedCompanies.map((company) => row.valores[company.id] || 0),
        ]),
      ];

      const indicesSheet = [
        ['Índice', ...companyHeaders],
        ...indicesRows.map((row) => [
          row.label,
          ...selectedCompanies.map((company) => row.valores[company.id] ?? ''),
        ]),
      ];

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(bpSheet), 'BP');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(dreSheet), 'DRE');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(indicesSheet), 'Indices');

      XLSX.writeFile(workbook, `comparativo_${selectedYear}.xlsx`);
    } catch (error) {
      console.error('Erro ao exportar Excel comparativo:', error);
      alert('Não foi possível exportar o Excel comparativo.');
    } finally {
      setExportingExcel(false);
    }
  };

  if (!isAllowedRole) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 font-semibold">Acesso restrito</p>
          <p className="text-amber-700 text-sm mt-1">Esta página está disponível apenas para ADMIN e GESTOR.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-violet-600 to-violet-700 rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <Columns3 className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Comparativo</h1>
        </div>
        <p className="text-violet-100">Demonstrações e índices comparativos entre empresas com acesso do usuário</p>
      </motion.div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-slate-800">Empresas no comparativo</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportPdf}
              disabled={generatingPdf || selectedCompanyIds.length < 2}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold shadow hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Exportar PDF
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel || selectedCompanyIds.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg font-semibold shadow hover:from-emerald-700 hover:to-emerald-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Exportar Excel
            </button>
          </div>
        </div>

        {loadingCompanies ? (
          <div className="text-sm text-slate-600">Carregando empresas...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {companies.map((company) => (
              <label
                key={company.id}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedCompanyIds.includes(company.id)
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCompanyIds.includes(company.id)}
                  onChange={() => toggleCompany(company.id)}
                  className="rounded"
                />
                <span className="text-sm font-medium text-slate-800">{company.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-[#08C97D] px-4 py-3">
              <h2 className="font-semibold text-white">Balanço Patrimonial - Comparativo ({selectedYear})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 w-16">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Conta</th>
                    {selectedCompanies.map((company) => (
                      <th key={`bp-${company.id}`} className="text-right px-4 py-3 font-semibold text-slate-700">
                        {company.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bpRows.map((row, idx) => (
                    <tr key={`bp-row-${row.codigo}`} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      <td className="px-4 py-2 text-slate-500 font-mono">{row.codigo}</td>
                      <td className={`px-4 py-2 text-slate-800 ${row.nivel <= 2 ? 'font-semibold' : ''}`} style={{ paddingLeft: `${16 + row.nivel * 12}px` }}>
                        {row.descricao}
                      </td>
                      {selectedCompanies.map((company) => (
                        <td key={`bp-${row.codigo}-${company.id}`} className={`text-right px-4 py-2 text-slate-700 ${row.nivel <= 2 ? 'font-semibold' : ''}`}>
                          {formatCurrency((row.valores[company.id] || 0) / 1000)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-[#07B670] px-4 py-3">
              <h2 className="font-semibold text-white">DRE - Comparativo ({selectedYear})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 w-16">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Conta</th>
                    {selectedCompanies.map((company) => (
                      <th key={`dre-${company.id}`} className="text-right px-4 py-3 font-semibold text-slate-700">
                        {company.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dreRows.map((row, idx) => (
                    <tr key={`dre-row-${row.codigo}`} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      <td className="px-4 py-2 text-slate-500 font-mono">{row.codigo}</td>
                      <td className={`px-4 py-2 text-slate-800 ${row.nivel <= 2 ? 'font-semibold' : ''}`} style={{ paddingLeft: `${16 + row.nivel * 12}px` }}>
                        {row.descricao}
                      </td>
                      {selectedCompanies.map((company) => (
                        <td key={`dre-${row.codigo}-${company.id}`} className={`text-right px-4 py-2 text-slate-700 ${row.nivel <= 2 ? 'font-semibold' : ''}`}>
                          {formatCurrency((row.valores[company.id] || 0) / 1000)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-emerald-600 px-4 py-3">
              <h2 className="font-semibold text-white">Índices - Comparativo ({selectedYear})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Índice</th>
                    {selectedCompanies.map((company) => (
                      <th key={`idx-${company.id}`} className="text-right px-4 py-3 font-semibold text-slate-700">
                        {company.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {indicesRows.map((row, idx) => (
                    <tr key={`idx-row-${row.key}`} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      <td className="px-4 py-2 text-slate-800">{row.label}</td>
                      {selectedCompanies.map((company) => {
                        const value = row.valores[company.id];
                        return (
                          <td key={`idx-${row.key}-${company.id}`} className="text-right px-4 py-2 text-slate-700">
                            {value === null ? '-' : Number(value).toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
