'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

interface IndicatorCardProps {
  title: string;
  values: Record<string, number> | { year: string; value: number }[];
  type?: 'number' | 'percent' | 'currency';
  format?: 'number' | 'percent' | 'currency'; // backward compatibility
  benchmark?: { min: number; max: number };
  description?: string;
  delay?: number;
  invertColors?: boolean; // Para índices onde valores baixos são melhores
}

export default function IndicatorCard({ 
  title, 
  values, 
  type,
  format,
  benchmark,
  description,
  delay = 0,
  invertColors = false
}: IndicatorCardProps) {
  
  const displayFormat = type || format || 'number';
  
  const formatValue = (v: number) => {
    const val = v ?? 0;
    if (displayFormat === 'percent') return `${val?.toFixed?.(2) ?? '0.00'}%`;
    if (displayFormat === 'currency') return `R$ ${(val * 1000)?.toLocaleString?.('pt-BR') ?? '0'}`;
    return val?.toFixed?.(2) ?? '0.00';
  };
  
  const getStatus = (value: number) => {
    if (!benchmark) return 'neutral';
    
    if (invertColors) {
      // Para índices onde valores mais baixos são melhores (ex: endividamento)
      if (value <= benchmark.min) return 'good';
      if (value <= benchmark.max) return 'warning';
      return 'bad';
    } else {
      // Comportamento padrão: valores mais altos são melhores
      if (value >= benchmark.max) return 'good';
      if (value >= benchmark.min) return 'warning';
      return 'bad';
    }
  };
  
  const statusColors = {
    good: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    bad: 'bg-red-100 text-red-700 border-red-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  // Normaliza valores para array
  const normalizedValues = Array.isArray(values) 
    ? values 
    : Object.entries(values).map(([year, value]) => ({ year, value }));
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white rounded-xl shadow-lg p-5 hover:shadow-xl transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {description && (
          <div className="group relative">
            <Info className="w-4 h-4 text-slate-400 cursor-help" />
            <div className="absolute right-0 top-6 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              {description}
            </div>
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        {normalizedValues?.map?.((item) => {
          const status = getStatus(item?.value ?? 0);
          return (
            <div key={item?.year} className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{item?.year}</span>
              <span className={cn(
                'px-3 py-1 rounded-full text-sm font-semibold border',
                statusColors[status]
              )}>
                {formatValue(item?.value ?? 0)}
              </span>
            </div>
          );
        }) ?? []}
      </div>
      
      {benchmark && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            Referência: {benchmark.min?.toFixed?.(2) ?? '0.00'} - {benchmark.max?.toFixed?.(2) ?? '0.00'}
          </p>
        </div>
      )}
    </motion.div>
  );
}
