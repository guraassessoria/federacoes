# 📋 Quick Reference - Inconsistências do Projeto

## 🎯 SUMÁRIO RÁPIDO

**Total de Inconsistências Identificadas:** 10  
**Críticas:** 3 | **Moderadas:** 4 | **Menores:** 3  
**Tempo Estimado para Correção:** 3-4 semanas  

---

## 🔴 CRÍTICAS (Semana 1)

### ✘ 1. Duplicação: BalanceteData vs BalanceteRow
- **Arquivo:** [prisma/schema.prisma](prisma/schema.prisma)
- **Problema:** Dois modelos praticamente idênticos com nomenclatura diferente
- **Impacto:** Confusão, duplicação de dados, migrations complexas
- **Ação:** Consolidar em modelo único `Balancete`
- **Prioridade:** 🔴 CRÍTICA
- **Tempo:** 3 dias
- **Risco:** Alto (alteração de schema)

**Checklist:**
- [ ] Criar migration Prisma
- [ ] Escrever script de migração de dados
- [ ] Testar migração em dev
- [ ] Atualizar todos os imports do projeto
- [ ] Verificar queries no banco

---

### ✘ 2. Múltiplos Storage Providers Sem Estratégia
- **Arquivos:** 
  - [lib/s3.ts](lib/s3.ts) - AWS S3
  - [app/api/upload/presigned/route.ts](app/api/upload/presigned/route.ts) - Vercel Blob
  - `@azure/storage-blob` - Não usado
- **Problema:** 3 providers instalados, lógica misturada
- **Impacto:** Bundle grande, confusão, upload instável
- **Ação:** Escolher um provider (Vercel Blob recomendado), criar abstração
- **Prioridade:** 🔴 CRÍTICA
- **Tempo:** 2 dias
- **Risco:** Médio (precisa testar uploads)

**Checklist:**
- [ ] Definir provider primário (Vercel Blob)
- [ ] Criar `StorageProvider` interface abstrata
- [ ] Implementar adapter para provider escolhido
- [ ] Remover dependências não usadas
- [ ] Testar uploads em produção
- [ ] Atualizar `.env`

---

### ✘ 3. Versões Desalinhadas Next.js
- **Arquivo:** [package.json](package.json)
- **Problema:** 
  - `next`: 14.2.28
  - `@next/swc-wasm-nodejs`: 13.5.1 ← DESALINHADA
  - `eslint-config-next`: 15.3.0
- **Impacto:** Build pode falhar, comportamento inconsistente
- **Ação:** Atualizar todas para 15.3.0
- **Prioridade:** 🔴 CRÍTICA
- **Tempo:** 1 dia
- **Risco:** Médio (breaking changes possíveis)

**Checklist:**
- [ ] Ler changelog Next.js 15.3.0
- [ ] Atualizar package.json
- [ ] `npm install`
- [ ] Rodar `npm run build`
- [ ] Testar em dev e produção

---

## 🟡 MODERADAS (Semana 2-3)

### ✘ 4. Exportações Inconsistentes em Componentes
- **Arquivos:** `components/**/*.tsx`
- **Problema:** Misto de `export default` e `export function`
- **Impacto:** Inconsistência, dificulta imports, refatoração complicada
- **Ação:** Padronizar para `export function` + barrel exports
- **Prioridade:** 🟡 MODERADA
- **Tempo:** 2 dias
- **Risco:** Baixo (refatoração "safe")

**Checklist:**
- [ ] Auditar todos os componentes
- [ ] Converter `export default` → `export function`
- [ ] Criar `components/index.ts` com barrel exports
- [ ] Atualizar imports em todo projeto
- [ ] Verificar que tudo ainda compila

---

### ✘ 5. Nomenclatura Mista: Inglês/Português
- **Arquivos:** Projeto todo
- **Problema:** snake_case + português, camelCase + inglês, inconsistência
- **Impacto:** Código confuso, difícil de navegar
- **Ação:** Estabelecer regra: Code=English, DB=snake_case, UI=português
- **Prioridade:** 🟡 MODERADA
- **Tempo:** 3 dias
- **Risco:** Médio (mudanças espalhadas)

**Checklist:**
- [ ] Padronizar interfaces TypeScript (English)
- [ ] Corrigir schema Prisma
- [ ] Implementar i18n para labels UI
- [ ] Documentar guia de estilo
- [ ] Code review de changes

---

### ✘ 6. Sem Validação com Zod
- **Arquivos:** `app/api/**/*.ts`
- **Problema:** APIs recebem strings sem validação, nenhuma garantia de tipo
- **Impacto:** Bugs runtime, SQL injection potencial, 500 errors
- **Ação:** Implementar Zod em todas as APIs
- **Prioridade:** 🟡 MODERADA
- **Tempo:** 2 dias
- **Risco:** Médio (pode quebrar algumas queries)

**Checklist:**
- [ ] Criar `lib/validators/index.ts`
- [ ] Escrever schemas para todas as APIs
- [ ] Integrar validação em rotas
- [ ] Testar com dados inválidos
- [ ] Documentar schema esperado

---

### ✘ 7. Tratamento de Erros Inconsistente
- **Arquivos:** `app/api/**/*.ts`
- **Problema:** Cada API trata erros diferente, sem logs estruturados
- **Impacto:** Difícil debugar, mensagens inconsistentes
- **Ação:** Centralizar error handling
- **Prioridade:** 🟡 MODERADA
- **Tempo:** 1 dia
- **Risco:** Baixo

**Checklist:**
- [ ] Criar `lib/errorHandler.ts`
- [ ] Definir `AppError` class
- [ ] Atualizar try-catch em todas APIs
- [ ] Implementar logger centralizado
- [ ] Testar error cases

---

## 🔵 MENORES (Semana 4)

### ✘ 8. Cache Manual com Variáveis Globais
- **Arquivo:** [lib/services/estruturaMapping.ts](lib/services/estruturaMapping.ts)
- **Problema:** Cache manual com variáveis globais, sem TTL, sem limpeza
- **Impacto:** Memory leak possível, dados desatualizados
- **Ação:** Usar CacheManager centralizado
- **Prioridade:** 🔵 MENOR
- **Tempo:** 1 dia
- **Risco:** Baixo

**Checklist:**
- [ ] Criar `lib/cache/index.ts`
- [ ] Implementar CacheManager com TTL
- [ ] Integrar em estruturaMapping
- [ ] Testar limpeza de cache

---

### ✘ 9. Imports Desordenados
- **Arquivos:** Projeto todo
- **Problema:** Imports sem padrão de organização
- **Impacto:** Código menos legível
- **Ação:** Aplicar ESLint rule `import/order`
- **Prioridade:** 🔵 MENOR
- **Tempo:** 0.5 dia
- **Risco:** Muito baixo

**Checklist:**
- [ ] Configurar `.eslintrc.json` com `import/order`
- [ ] Rodar `npx eslint . --fix`
- [ ] Revisar mudanças

---

### ✘ 10. Magic Strings Espalhadas (Sem Constantes)
- **Arquivos:** Projeto todo
- **Problema:** `/api/...`, `/admin`, strings de rotas hardcoded
- **Impacto:** Difícil manutenção, erros de digitação
- **Ação:** Criar `lib/constants.ts`
- **Prioridade:** 🔵 MENOR
- **Tempo:** 1 dia
- **Risco:** Baixo

**Checklist:**
- [ ] Criar `lib/constants.ts`
- [ ] Definir API_ENDPOINTS, ROUTES, etc
- [ ] Substituir strings hardcoded
- [ ] Atualizar imports

---

## 📊 MATRIZ DE AÇÃO

| # | Títulos | Sever | Afeta | Est. Tempo | Risco | Status |
|---|---------|-------|-------|-----------|-------|--------|
| 1 | BalanceteData/Row | 🔴 | Schema | 3d | Alto | ☐ |
| 2 | Multiple Storage | 🔴 | Deploy | 2d | Médio | ☐ |
| 3 | Next.js Versioning | 🔴 | Build | 1d | Médio | ☐ |
| 4 | Exports | 🟡 | Imports | 2d | Baixo | ☐ |
| 5 | Nomenclatura | 🟡 | Código | 3d | Médio | ☐ |
| 6 | Validação Zod | 🟡 | APIs | 2d | Médio | ☐ |
| 7 | Error Handling | 🟡 | Debug | 1d | Baixo | ☐ |
| 8 | Cache | 🔵 | Memory | 1d | Baixo | ☐ |
| 9 | Imports | 🔵 | Lint | 0.5d | Muito Baixo | ☐ |
| 10 | Constants | 🔵 | Maint. | 1d | Baixo | ☐ |

---

## 🚀 ROADMAP SUGERIDO

### SPRINT 1: Críticas (1-2 semanas)
```
✓ Segunda: BalanceteData consolidação
✓ Quarta: Storage Provider definição  
✓ Sexta: Next.js upgrade
      → Build limpo, sem warnings
      → Testes em dev
```

### SPRINT 2: Moderadas (2-3 semanas)
```
✓ Segunda: Componentes exports padronizados
✓ Terça: Nomenclatura Prisma/Type
✓ Quarta/Quinta: Zod + Error Handling
      → Todas APIs com validação
      → Logs estruturados
```

### SPRINT 3: Menores + QA (1 semana)
```
✓ Segunda: Cache Manager
✓ Terça: Imports + Constants
✓ Quarta/Quinta: Testes + Docs
      → Projeto limpo
      → Pronto para deploy
```

---

## 📱 CODE REVIEW CHECKLIST

Ao revisar cada correção, verificar:

- [ ] Compila sem warnings
- [ ] ESLint 100% clean
- [ ] TypeScript strict mode OK
- [ ] Testes passam (se houver)
- [ ] Documentação atualizada
- [ ] Breaking changes documentados
- [ ] Migration path claro
- [ ] Rollback possível
- [ ] Performance OK
- [ ] Segurança OK

---

## 📞 CONTATO PARA DÚVIDAS

**Arquivo Principal de Análise:**  
[ANALISE_INCONSISTENCIAS.md](ANALISE_INCONSISTENCIAS.md)

**Guia de Correções:**  
[GUIA_CORRECOES.md](GUIA_CORRECOES.md)

**Visualizações:**  
[VISUALIZACAO_INCONSISTENCIAS.md](VISUALIZACAO_INCONSISTENCIAS.md)

---

## ⏱️ RESUMO DE TEMPO

| Fase | Duração | Pré-requisitos | Frutas |
|------|---------|---|---|
| Fase 1 (Críticas) | 1-2 semanas | Nenhum | Alto |
| Fase 2 (Moderadas) | 2-3 semanas | Fase 1 ✓ | Médio |
| Fase 3 (Menores) | 1 semana | Fase 2 ✓ | Baixo |
| **TOTAL** | **3-4 semanas** | - | **ALTO** |

**Preço Benefício:** 🟢🟢🟢🟢 (4/5 stars)  
Investimento pequeno agora = economia grande depois

---

## 🎓 PRÓXIMOS PASSOS

1. **Ler** [ANALISE_INCONSISTENCIAS.md](ANALISE_INCONSISTENCIAS.md)
2. **Entender** [VISUALIZACAO_INCONSISTENCIAS.md](VISUALIZACAO_INCONSISTENCIAS.md)
3. **Implementar** [GUIA_CORRECOES.md](GUIA_CORRECOES.md)
4. **Testar** tudo localmente
5. **Deploy** em staging first
6. **Validar** em produção

---

**Análise Concluída:** ✅  
**Status:** Pronto para ação  
**Data:** 02/03/2026  
**Autor:** Code Analysis Bot
