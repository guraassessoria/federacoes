'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  previousValue?: string;
  change?: number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  delay?: number;
}

const colorClasses = {
  blue: 'from-blue-500 to-blue-600',
  green: 'from-emerald-500 to-emerald-600',
  purple: 'from-purple-500 to-purple-600',
  orange: 'from-orange-500 to-orange-600',
  red: 'from-red-500 to-red-600',
};

export function KPICard({ title, value, previousValue, change, icon: Icon, color = 'blue', delay = 0 }: KPICardProps) {
  const changeValue = change ?? 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-slate-500 font-medium mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            {previousValue && (
              <p className="text-xs text-slate-400 mt-1">Anterior: {previousValue}</p>
            )}
          </div>
          <div className={cn('w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center', colorClasses[color])}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        
        {change !== undefined && (
          <div className="mt-4 flex items-center gap-2">
            {changeValue > 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : changeValue < 0 ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : (
              <Minus className="w-4 h-4 text-slate-400" />
            )}
            <span className={cn(
              'text-sm font-medium',
              changeValue > 0 ? 'text-emerald-500' : changeValue < 0 ? 'text-red-500' : 'text-slate-400'
            )}>
              {changeValue > 0 ? '+' : ''}{changeValue?.toFixed?.(2) ?? '0.00'}%
            </span>
            <span className="text-xs text-slate-400">vs ano anterior</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default KPICard;
