/**
 * 成長記録画面用の軽量 SVG グラフコンポーネント
 * 外部ライブラリを追加せず、SVG で直接描画する。
 */

import { useState } from 'react';
import type { DailyGrowth, SpeedGateDailyResult } from '../types/growth';
import { formatMs } from '../utils/growthStats';

interface LineChartProps {
  data: DailyGrowth[];
  width?: number;
  height?: number;
  metric: 'accuracy' | 'time';
}

interface BarChartProps {
  data: DailyGrowth[];
  width?: number;
  height?: number;
}

interface SpeedGateChartProps {
  data: SpeedGateDailyResult[];
  width?: number;
  height?: number;
}

function getMaxValue(data: DailyGrowth[], metric: 'accuracy' | 'time'): number {
  if (data.length === 0) return 100;
  if (metric === 'accuracy') {
    return Math.max(100, ...data.map((d) => d.accuracyRate));
  }
  return Math.max(10, ...data.map((d) => d.averageTimeSec));
}

/** 正答率の折線グラフ */
export function AccuracyLineChart({ data, width = 340, height = 180, metric = 'accuracy' }: LineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
        データなし
      </div>
    );
  }

  const maxVal = getMaxValue(data, metric);
  const padding = { top: 24, right: 24, bottom: 36, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (val: number) => padding.top + chartHeight - (val / maxVal) * chartHeight;

  const points = data.map((d, i) => {
    const val = metric === 'accuracy' ? d.accuracyRate : d.averageTimeSec;
    return `${xScale(i)},${yScale(val)}`;
  }).join(' ');

  const yLabels = metric === 'accuracy' ? [0, 50, 100] : [0, 30, 60];

  return (
    <div style={{ width, fontSize: '0.9rem', position: 'relative' }}>
      <h4 style={{ marginBottom: 8, fontSize: '1rem', color: '#333' }}>
        {metric === 'accuracy' ? '日別正答率' : '日別平均回答時間'}
      </h4>
      <svg width={width} height={height} role="img" aria-label={metric === 'accuracy' ? '日別正答率の折線グラフ' : '日別平均回答時間の折線グラフ'}>
        {yLabels.map((label) => {
          const y = yScale(label);
          return (
            <g key={label}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e0e0e0" strokeWidth={1} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#666">{label}</text>
            </g>
          );
        })}
        <polyline points={points} fill="none" stroke="#4a90d9" strokeWidth={2.5} />
        {data.map((d, i) => {
          const val = metric === 'accuracy' ? d.accuracyRate : d.averageTimeSec;
          const isHovered = hoveredIndex === i;
          return (
            <circle
              key={i}
              cx={xScale(i)}
              cy={yScale(val)}
              r={isHovered ? 6 : 4}
              fill={isHovered ? '#2a6fb0' : '#4a90d9'}
              stroke="#fff"
              strokeWidth={2}
              style={{ cursor: 'pointer', transition: 'r 0.15s' }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          );
        })}
        {data.map((d, i) => {
          const x = xScale(i);
          const isEdge = i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 5) === 0;
          if (!isEdge) return null;
          return (
            <text key={i} x={x} y={padding.top + chartHeight + 20} textAnchor="middle" fontSize="11" fill="#666">
              {formatDateLabel(d.dateKey)}
            </text>
          );
        })}
      </svg>
      {hoveredIndex !== null && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(xScale(hoveredIndex) + 12, width - 160),
            top: Math.max(yScale(metric === 'accuracy' ? data[hoveredIndex].accuracyRate : data[hoveredIndex].averageTimeSec) - 80, 0),
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: '8px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            zIndex: 10,
            pointerEvents: 'none',
            minWidth: 140,
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#333' }}>
            {formatDateLabel(data[hoveredIndex].dateKey)}
          </div>
          <div>問題数: {data[hoveredIndex].questionCount} 問</div>
          <div>正答数: {data[hoveredIndex].correctCount} 問</div>
          <div>正答率: {data[hoveredIndex].accuracyRate}%</div>
          <div>平均時間: {formatMs(data[hoveredIndex].averageTimeSec * 1000)}</div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.85rem', color: '#666' }}>
        <span>左: 0%</span>
        <span>右: {maxVal}%</span>
      </div>
    </div>
  );
}
export function QuestionCountBarChart({ data, width = 340, height = 180 }: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
        データなし
      </div>
    );
  }

  const maxCount = Math.max(5, ...data.map((d) => d.questionCount));
  const padding = { top: 24, right: 24, bottom: 36, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barWidth = chartWidth / data.length * 0.6;

  return (
    <div style={{ width, fontSize: '0.9rem', position: 'relative' }}>
      <h4 style={{ marginBottom: 8, fontSize: '1rem', color: '#333' }}>日別学習問題数</h4>
      <svg width={width} height={height} role="img" aria-label="日別学習問題数の棒グラフ">
        {data.map((d, i) => {
          const barHeight = (d.questionCount / maxCount) * chartHeight;
          const x = padding.left + (i / data.length) * chartWidth + (chartWidth / data.length - barWidth) / 2;
          const y = padding.top + chartHeight - barHeight;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={hoveredIndex === i ? '#388e3c' : '#4caf50'}
                style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="#4caf50">
                {d.questionCount}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = padding.left + (i / data.length) * chartWidth + chartWidth / data.length / 2;
          const isEdge = i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 5) === 0;
          if (!isEdge) return null;
          return (
            <text key={i} x={x} y={padding.top + chartHeight + 20} textAnchor="middle" fontSize="11" fill="#666">
              {formatDateLabel(d.dateKey)}
            </text>
          );
        })}
      </svg>
      {hoveredIndex !== null && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(padding.left + (hoveredIndex / data.length) * chartWidth + chartWidth / data.length / 2 + 12, width - 160),
            top: Math.max(padding.top + chartHeight - (data[hoveredIndex].questionCount / maxCount) * chartHeight - 80, 0),
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: '8px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            zIndex: 10,
            pointerEvents: 'none',
            minWidth: 140,
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#333' }}>
            {formatDateLabel(data[hoveredIndex].dateKey)}
          </div>
          <div>問題数: {data[hoveredIndex].questionCount} 問</div>
          <div>正答数: {data[hoveredIndex].correctCount} 問</div>
          <div>正答率: {data[hoveredIndex].accuracyRate}%</div>
          <div>平均時間: {formatMs(data[hoveredIndex].averageTimeSec * 1000)}</div>
        </div>
      )}
    </div>
  );
}

/** 朝100問正答率の折線グラフ */
export function SpeedGateAccuracyChart({ data, width = 340, height = 180 }: SpeedGateChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
        データなし
      </div>
    );
  }

  const maxVal = getSpeedGateMaxValue(data);
  const padding = { top: 24, right: 24, bottom: 36, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (val: number) => padding.top + chartHeight - (val / maxVal) * chartHeight;

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.accuracyRate)}`).join(' ');

  return (
    <div style={{ width, fontSize: '0.9rem', position: 'relative' }}>
      <h4 style={{ marginBottom: 8, fontSize: '1rem', color: '#333' }}>朝の100問 日別正答率</h4>
      <svg width={width} height={height} role="img" aria-label="朝の100問 日別正答率の折線グラフ">
        <line x1={padding.left} y1={yScale(50)} x2={width - padding.right} y2={yScale(50)} stroke="#e0e0e0" strokeWidth={1} />
        <text x={padding.left - 8} y={yScale(50) + 4} textAnchor="end" fontSize="11" fill="#666">50%</text>
        <line x1={padding.left} y1={yScale(100)} x2={width - padding.right} y2={yScale(100)} stroke="#e0e0e0" strokeWidth={1} />
        <text x={padding.left - 8} y={yScale(100) + 4} textAnchor="end" fontSize="11" fill="#666">100%</text>
        <polyline points={points} fill="none" stroke="#ff9800" strokeWidth={2.5} />
        {data.map((d, i) => {
          const isHovered = hoveredIndex === i;
          return (
            <circle
              key={i}
              cx={xScale(i)}
              cy={yScale(d.accuracyRate)}
              r={isHovered ? 6 : 4}
              fill={isHovered ? '#e65100' : '#ff9800'}
              stroke="#fff"
              strokeWidth={2}
              style={{ cursor: 'pointer', transition: 'r 0.15s' }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          );
        })}
        {data.map((d, i) => {
          const x = xScale(i);
          const isEdge = i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 5) === 0;
          if (!isEdge) return null;
          return (
            <text key={i} x={x} y={padding.top + chartHeight + 20} textAnchor="middle" fontSize="11" fill="#666">
              {formatDateLabel(d.dateKey)}
            </text>
          );
        })}
      </svg>
      {hoveredIndex !== null && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(xScale(hoveredIndex) + 12, width - 180),
            top: Math.max(yScale(data[hoveredIndex].accuracyRate) - 90, 0),
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: '8px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            zIndex: 10,
            pointerEvents: 'none',
            minWidth: 160,
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#333' }}>
            {formatDateLabel(data[hoveredIndex].dateKey)}
          </div>
          <div>正答数: {data[hoveredIndex].correctCount} / {data[hoveredIndex].totalCount}</div>
          <div>正答率: {data[hoveredIndex].accuracyRate}%</div>
          <div>平均時間: {formatMs(data[hoveredIndex].averageMs)}</div>
          <div>合計時間: {formatMs(data[hoveredIndex].totalMs)}</div>
        </div>
      )}
    </div>
  );
}

function getSpeedGateMaxValue(data: SpeedGateDailyResult[]): number {
  if (data.length === 0) return 100;
  return Math.max(100, ...data.map((d) => d.accuracyRate));
}

function formatDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split('-').map(Number);
  return `${month}/${day}`;
}