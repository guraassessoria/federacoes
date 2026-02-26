'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface DataPoint {
  name: string;
  [key: string]: string | number;
}

interface LineChartProps {
  data: DataPoint[];
  lines: { dataKey: string; color: string; name: string }[];
  yAxisLabel?: string;
}

export default function CustomLineChart({ data, lines, yAxisLabel }: LineChartProps) {
  const safeData = data ?? [];
  const safeLines = lines ?? [];
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={safeData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <XAxis 
          dataKey="name" 
          tickLine={false} 
          tick={{ fontSize: 12, fill: '#374151' }} 
        />
        <YAxis 
          tickLine={false} 
          tick={{ fontSize: 11, fill: '#374151' }}
          label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11, fill: '#374151' } } : undefined}
        />
        <Tooltip 
          contentStyle={{ fontSize: 11, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }}
          formatter={(value: number) => [`R$ ${(value * 1000)?.toLocaleString?.('pt-BR') ?? '0'}`, '']}
        />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, color: '#374151' }} />
        {safeLines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.color}
            strokeWidth={3}
            name={line.name}
            dot={{ r: 6, strokeWidth: 2, fill: 'white' }}
            activeDot={{ r: 8 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
