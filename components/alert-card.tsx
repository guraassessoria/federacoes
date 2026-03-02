'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertCardProps {
  tipo: string;
  categoria: string;
  descricao: string;
  valor: number;
  recomendacao: string;
  delay?: number;
}

export function AlertCard({ tipo, categoria, descricao, valor, recomendacao, delay = 0 }: AlertCardProps) {
  const isOportunidade = tipo === 'oportunidade';
  const isAtencao = tipo === 'atencao';
  
  const Icon = isOportunidade ? Lightbulb : isAtencao ? AlertTriangle : CheckCircle;
  const bgColor = isOportunidade ? 'bg-blue-50 border-blue-200' : isAtencao ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';
  const iconColor = isOportunidade ? 'text-blue-500' : isAtencao ? 'text-amber-500' : 'text-emerald-500';
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn('rounded-xl border p-5', bgColor)}
    >
      <div className="flex items-start gap-4">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', isOportunidade ? 'bg-blue-100' : isAtencao ? 'bg-amber-100' : 'bg-emerald-100')}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{categoria}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', isOportunidade ? 'bg-blue-100 text-blue-700' : isAtencao ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
              {tipo === 'oportunidade' ? 'Oportunidade' : tipo === 'atencao' ? 'Atencao' : 'Positivo'}
            </span>
          </div>
          <p className="text-sm text-slate-700 font-medium mb-2">{descricao}</p>
          <p className="text-lg font-bold text-slate-800 mb-2">
            {typeof valor === 'number' && valor > 100 ? `R$ ${(valor * 1000)?.toLocaleString?.('pt-BR') ?? '0'}` : valor?.toFixed?.(2) ?? '0.00'}
          </p>
          <p className="text-xs text-slate-500 italic">Dica: {recomendacao}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default AlertCard;
