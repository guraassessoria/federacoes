'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface DataPoint {
  name: string;
  [key: string]: string | number;
}

interface BarChartProps {
  data: DataPoint[];
  bars: { dataKey: string; color: string; name: string }[];
  layout?: 'vertical' | 'horizontal';
  stacked?: boolean;
  showPercent?: boolean;
}

export function CustomBarChart({ data, bars, layout = 'horizontal', stacked = false, showPercent = false }: BarChartProps) {
  const safeData = data ?? [];
  const safeBars = bars ?? [];
  
  if (layout === 'vertical') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(300, safeData.length * 40)}>
        <BarChart data={safeData} layout="vertical" margin={{ top: 20, right: 30, left: 120, bottom: 20 }}>
          <XAxis type="number" tickLine={false} tick={{ fontSize: 11, fill: '#374151' }} />
          <YAxis type="category" dataKey="name" tickLine={false} tick={{ fontSize: 11, fill: '#374151' }} width={110} />
          <Tooltip 
            contentStyle={{ fontSize: 11, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }}
            formatter={(value: number) => [showPercent ? `${value?.toFixed?.(2) ?? '0.00'}%` : `R$ ${(value * 1000)?.toLocaleString?.('pt-BR') ?? '0'}`, '']}
          />
          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, color: '#374151' }} />
          {safeBars.map((bar) => (
            <Bar key={bar.dataKey} dataKey={bar.dataKey} fill={bar.color} name={bar.name} stackId={stacked ? 'stack' : undefined} radius={[0, 4, 4, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={safeData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 12, fill: '#374151' }} />
        <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#374151' }} />
        <Tooltip 
          contentStyle={{ fontSize: 11, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }}
          formatter={(value: number) => [showPercent ? `${value?.toFixed?.(2) ?? '0.00'}%` : `R$ ${(value * 1000)?.toLocaleString?.('pt-BR') ?? '0'}`, '']}
        />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, color: '#374151' }} />
        {safeBars.map((bar) => (
          <Bar key={bar.dataKey} dataKey={bar.dataKey} fill={bar.color} name={bar.name} stackId={stacked ? 'stack' : undefined} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default CustomBarChart;
