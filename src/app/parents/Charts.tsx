"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { name: string; last4: number; last12: number };

const INK = "#1b1f3a";
const LIME = "#d6f25a";
const LILAC = "#c9b8ff";
const PAPER = "#f7f3ea";
const MUTED = "#7c7f94";

function Chart({
  data,
  dataKey,
  fill,
  max,
}: {
  data: Row[];
  dataKey: "last4" | "last12";
  fill: string;
  max: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="rgba(247,243,234,.14)" />
        <XAxis
          type="number"
          domain={[0, max]}
          allowDecimals={false}
          tick={{ fill: MUTED, fontSize: 12, fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fill: PAPER, fontSize: 13, fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(247,243,234,.07)" }}
          contentStyle={{
            background: PAPER,
            border: 0,
            borderRadius: 14,
            color: INK,
            fontWeight: 700,
            fontSize: 13,
          }}
          labelStyle={{ color: MUTED, fontWeight: 800 }}
          formatter={(value) => [`${String(value)} done`, ""]}
        />
        <Bar dataKey={dataKey} fill={fill} radius={[0, 8, 8, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Charts({ data }: { data: Row[] }) {
  if (data.length === 0) {
    return <p className="hint">Nothing recorded yet.</p>;
  }

  return (
    <div className="charts">
      <div className="chartbox">
        <h3>Last 4 weeks</h3>
        <p>Out of 28 days</p>
        <Chart data={data} dataKey="last4" fill={LIME} max={28} />
      </div>
      <div className="chartbox">
        <h3>Last 12 weeks</h3>
        <p>Out of 84 days</p>
        <Chart data={data} dataKey="last12" fill={LILAC} max={84} />
      </div>
    </div>
  );
}
