'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface DataPoint {
  name: string;
  value: number;
}

interface PieChartProps {
  data: DataPoint[];
  colors: string[];
  showLabels?: boolean;
}

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {`${((percent ?? 0) * 100)?.toFixed?.(0) ?? '0'}%`}
    </text>
  );
};

export default function CustomPieChart({ data, colors, showLabels = true }: PieChartProps) {
  const safeData = data ?? [];
  const safeColors = colors ?? [];
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={safeData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={showLabels ? renderCustomizedLabel : undefined}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {safeData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={safeColors[index % safeColors.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ fontSize: 11, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }}
          formatter={(value: number) => [`R$ ${(value * 1000)?.toLocaleString?.('pt-BR') ?? '0'}`, '']}
        />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
