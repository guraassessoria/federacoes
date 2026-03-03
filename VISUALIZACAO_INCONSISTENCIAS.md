# Visualização das Inconsistências

## 📊 Mapa Visual do Projeto

```
DASHBOARD FINANCEIRO
│
├── 🔴 CRÍTICAS (Fase 1 - 1-2 semanas)
│   ├─ BalanceteData vs BalanceteRow (DUPLICAÇÃO)
│   ├─ S3 vs Azure vs Vercel (MÚLTIPLO STORAGE)
│   └─ Next.js v13/14/15 DESALINHADO
│
├── 🟡 MODERADAS (Fase 2 - 2-3 semanas)
│   ├─ Export default vs named exports
│   ├─ Inglês/Português misto
│   ├─ Sem validação Zod
│   └─ Error handling inconsistente
│
└── 🔵 MENORES (Fase 3 - 1 semana)
    ├─ Cache manual
    ├─ Imports desordenados
    └─ Magic strings (sem constantes)
```

---

## 🗂️ ESTRUTURA ATUAL vs IDEAL

### ANTES: Duplicação no Schema

```
┌─────────────────────────────────────┐
│      BANCO DE DADOS (Prisma)        │
├─────────────────────────────────────┤
│                                     │
│  ❌ BalanceteData (English + Camel) │
│  ├─ accountNumber                   │
│  ├─ previousBalance                 │
│  └─ period                          │
│                                     │
│  ❌ BalanceteRow (Portuguese + Camel) │
│  ├─ conta                           │
│  ├─ saldoInicial                    │
│  └─ periodo                         │
│                                     │
│  [CONFUSÃO: Qual usar?]            │
│                                     │
└─────────────────────────────────────┘
```

### DEPOIS: Unificado

```
┌─────────────────────────────────────┐
│      BANCO DE DADOS (Prisma)        │
├─────────────────────────────────────┤
│                                     │
│  ✅ Balancete (English + Camel)     │
│  ├─ accountCode                     │
│  ├─ accountDescription              │
│  ├─ openingBalance                  │
│  ├─ debit                           │
│  ├─ credit                          │
│  └─ closingBalance                  │
│                                     │
│  [CLARO: Uma fonte de verdade]     │
│                                     │
└─────────────────────────────────────┘
```

---

## 🏗️ ARQUITETURA DE STORAGE

### ANTES: Confuso (3 providers)

```
┌──────────────────────────────────────┐
│    APLICAÇÃO (Upload/Download)       │
├──────────────┬───────────┬───────────┤
│              │           │           │
│          AWS S3    Azure Blob    Vercel Blob
│    (implementado)  (órfão)   (implementado)
│
❌ Package.json tem 3 providers
❌ Código mistura lógicas
❌ Não está claro qual usar
❌ Dependências extras
```

### DEPOIS: Determinado (1 principal)

```
┌──────────────────────────────────────┐
│    APLICAÇÃO (Upload/Download)       │
├──────────────────────────────────────┤
│           Storage Abstraction         │
│    (StorageProvider Interface)        │
├──────────────────────────────────────┤
│                                      │
│           Vercel Blob 🎯             │
│      (Provedor principal)             │
│ (Remove Azure, Remove S3 SDK)        │
│                                      │
✅ Package.json limpo
✅ Código centralizado
✅ Claro qual usar
✅ Sem deps extras
```

---

## 📦 VERSIONAMENTO NEXT.JS

### ANTES: Versões Conflitantes

```
package.json
│
├─ next: 14.2.28        ⚠️
├─ @next/swc...: 13.5.1  ⚠️  DESALINHADO
└─ eslint-config-next: 15.3.0  ⚠️

Resultado: Compilador pode não funcionar corretamente
```

### DEPOIS: Alinhado

```
package.json
│
├─ next: 15.3.0         ✅
├─ @next/swc...: 15.3.0  ✅  COERENTE
└─ eslint-config-next: 15.3.0  ✅

Resultado: Todos os componentes conhecem-se
```

---

## 🎨 PADRÃO DE COMPONENTES

### ANTES: Misto

```
components/
├─ kpi-card.tsx
│  └─ export default function KPICard() ❌
├─ sidebar.tsx
│  └─ export default function Sidebar() ❌
├─ providers.tsx
│  └─ export function Providers() ✓
└─ indicator-card.tsx
   └─ export default function IndicatorCard() ❌

Import: 
  import KPICard from '@/components/kpi-card'    ❌
  import { Providers } from '@/components'       ✓
  import IndicatorCard from '@/...'              ❌
```

### DEPOIS: Consistente

```
components/
├─ kpi-card.tsx
│  └─ export function KPICard() ✅
├─ sidebar.tsx
│  └─ export function Sidebar() ✅
├─ providers.tsx
│  └─ export function Providers() ✅
├─ indicator-card.tsx
│  └─ export function IndicatorCard() ✅
└─ index.ts (Barrel Export)
   └─ export { KPICard, Sidebar, Providers, ... }

Import uniforme:
  import { KPICard, Sidebar, Providers } from '@/components'  ✅
```

---

## 📝 NOMENCLATURA: Inglês vs Português

### ANTES: Caótico

```
Interfaces TypeScript (português):
├─ interface KPIs {
│  ├─ receita_total ❌ snake_case + português
│  ├─ resultado_liquido ❌
│  └─ roe ✓ (inglês, mas OK)

Prisma Schema (misto):
├─ BalanceteData {
│  ├─ accountNumber ✓ camelCase + English
│  ├─ previousBalance ✓
│  └─ period ✓

├─ BalanceteRow {
│  ├─ conta ❌ português puro
│  ├─ saldoInicial ❌ camelCase + português
│  └─ periodo ❌

UI Labels:
├─ "Resumo Executivo" ✓ português
└─ 'DRE' ✓ português
```

### DEPOIS: Consistente

```
Regra Simples:
┌──────────────────────────────────────┐
│ TypeScript/Code: camelCase + English │
├──────────────────────────────────────┤
│ Database: snake_case + English       │
├──────────────────────────────────────┤
│ UI Labels: Português (i18n)          │
└──────────────────────────────────────┘

Interfaces TypeScript (sempre English):
├─ interface FinancialMetrics {
│  ├─ totalIncome: number ✅
│  ├─ netResult: number ✅
│  └─ roe: number ✅

Prisma Schema (English):
├─ model Balancete {
│  ├─ accountCode: string ✅
│  ├─ openingBalance: Decimal ✅
│  └─ closingBalance: Decimal ✅

UI Labels (Portuguese via i18n):
├─ i18n.t('financials.totalIncome') → "Receita Total"
└─ i18n.t('financials.netResult') → "Resultado Líquido"
```

---

## ✔️ VALIDAÇÃO: Antes vs Depois

### ANTES: Sem Segurança de Tipos

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const companyId = searchParams.get("companyId");      // ❌ string | null
  const viewMode = searchParams.get("viewMode");        // ❌ string | null
  const year = searchParams.get("year");                // ❌ string | null
  
  // Nenhuma validação! Pode quebrar em runtime
  const data = await fetch(`SELECT * FROM ...`);
  // ^ SQL injection possível!
}
```

### DEPOIS: Type-Safe com Zod

```typescript
import { z } from 'zod';

const GetFinancialDataSchema = z.object({
  companyId: z.string().uuid('Valid UUID required'),
  viewMode: z.enum(['anual', 'mensal']).default('anual'),
  year: z.string().regex(/^\d{4}$/, 'YYYY format required'),
});

export async function GET(request: NextRequest) {
  try {
    const params = GetFinancialDataSchema.parse({
      companyId: searchParams.get("companyId"),
      viewMode: searchParams.get("viewMode"),
      year: searchParams.get("year"),
    });
    
    // ✅ params é type-safe!
    // ✅ Sem SQL injection
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }
  }
}
```

---

## 🚨 ERROR HANDLING: Centralizado

### ANTES: Inconsistente

```
API 1:
catch (error) {
  console.error("Error:", error);
  return NextResponse.json({ error: "Erro" }, { status: 500 });
}

API 2:
catch (error: any) {
  console.error("Upload failed:", error.message);
  return NextResponse.json({ error: "Upload falhou" }, { status: 500 });
}

API 3:
catch (e) {
  // Sem log! 😱
}

❌ Impossível debugar
❌ Mensagens inconsistentes
❌ Sem stack traces
```

### DEPOIS: Centralizado

```typescript
// lib/errorHandler.ts
class AppError extends Error {
  constructor(message, statusCode, code) { ... }
}

function handleApiError(error) {
  if (error instanceof AppError) {
    return { status: error.statusCode, body: {...} };
  }
  if (error instanceof z.ZodError) {
    return { status: 400, body: {...} };
  }
  logger.error(error);
  return { status: 500, body: {...} };
}

// Em todas as APIs:
try {
  // lógica
} catch (error) {
  const { status, body } = handleApiError(error);
  return NextResponse.json(body, { status });
}

✅ Consistente em todo projeto
✅ Fácil de debugar
✅ Mensagens padronizadas
```

---

## 🔄 FLUXO DE CORREÇÃO RECOMENDADO

```
SEMANA 1: CRÍTICAS
│
├─ Dia 1-2: Preparar migration Balancete
├─ Dia 3-4: Definir Storage Provider
├─ Dia 5: Atualizar Next.js
└─ Dia 6-7: Testar Build

     ↓

SEMANA 2-3: MODERADAS
│
├─ Dia 1-2: Padronizar Exports
├─ Dia 3-4: Implementar Zod
├─ Dia 5-6: Centralizar Error Handling
└─ Dia 7: Criar Constants

     ↓

SEMANA 4: MENORES + QA
│
├─ Dia 1-2: Organizar Imports
├─ Dia 3: Cache Manager
├─ Dia 4-5: Testes + Docs
└─ Dia 6-7: Deploy + Monitor
```

---

## 📊 IMPACTO POTENCIAL

| Inconsistência | Impacto | Severidade | User Impact |
|---|---|---|---|
| BalanceteData/Row | Confusão dev, dados inconsistentes | 🔴 Alta | ⚠️ Possível perda dados |
| Storage múltiplo | Deploy instável | 🔴 Alta | ⚠️ Upload pode falhar |
| Versionamento | Erros build | 🔴 Alta | ⚠️ App não compila |
| Exportações | Dificuldade manutenção | 🟡 Média | ✓ Sem impacto direto |
| Nomenclatura | Novos devs confusos | 🟡 Média | ✓ Sem impacto direto |
| Sem Zod | Bugs runtime | 🟡 Média | ⚠️ Erro 500 ocasional |
| Error handling | Difícil debug | 🟡 Média | ✓ Sem impacto direto |
| Cache manual | Memory leak | 🔵 Baixa | ⚠️ Lentidão eventual |
| Imports bagunçados | Confusão | 🔵 Baixa | ✓ Sem impacto direto |
| Magic strings | Manutenção dificultada | 🔵 Baixa | ✓ Sem impacto direto |

---

## ✅ DEFINIÇÃO DE SUCESSO

### Métrica 1: Build
- [ ] Próxima build sem warnings
- [ ] SWC, Next.js, ESLint alinhados

### Métrica 2: Code Quality
- [ ] 0 modelos duplicados no schema
- [ ] 100% componentes com named exports
- [ ] Todas APIs com Zod validation

### Métrica 3: Manutenibilidade
- [ ] Novos devs conseguem navegar em 1 dia
- [ ] Padrões documentados
- [ ] Sem "magic strings"

### Métrica 4: Operacional
- [ ] 1 storage provider apenas
- [ ] Erros são loggados de forma consistente
- [ ] Cache funciona sem memory leaks

---

**Prepared by:** Code Analysis Agent  
**Date:** 02/03/2026  
**Status:** ✅ Pronto para ação
