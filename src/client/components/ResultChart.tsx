// SPDX-License-Identifier: AGPL-3.0-or-later
import React, { useState } from "react";
import type { SecondSample } from "../../shared/stats";
import { UI_STRINGS, type UiLang } from "../i18n";

interface ResultChartProps {
  samples: SecondSample[];
  uiLang?: UiLang;
}

export function ResultChart({ samples, uiLang = "tr" }: ResultChartProps) {
  const t = UI_STRINGS[uiLang];
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (samples.length === 0) return null;

  const width = 820;
  const height = 190;
  const padLeft = 38;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxWpmRaw = Math.max(
    60,
    ...samples.map((s) => Math.max(s.wpm, s.raw))
  );
  const maxY = Math.ceil(maxWpmRaw / 20) * 20;

  const getX = (idx: number) => {
    if (samples.length === 1) return padLeft + plotW / 2;
    return padLeft + (idx / (samples.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(maxY, val));
    return padTop + plotH - (clamped / maxY) * plotH;
  };

  const wpmPoints = samples.map((s, i) => `${getX(i).toFixed(1)},${getY(s.wpm).toFixed(1)}`).join(" ");
  const rawPoints = samples.map((s, i) => `${getX(i).toFixed(1)},${getY(s.raw).toFixed(1)}`).join(" ");

  const areaPoints =
    samples.length > 1
      ? `${getX(0).toFixed(1)},${(padTop + plotH).toFixed(1)} ${wpmPoints} ${getX(
          samples.length - 1
        ).toFixed(1)},${(padTop + plotH).toFixed(1)}`
      : "";

  const yTicks = [0, Math.round(maxY / 2), maxY];
  const xStep = Math.max(1, Math.ceil(samples.length / 10));

  const hovered = hoverIdx !== null ? samples[hoverIdx] : null;

  return (
    <div className="result-chart-wrap">
      <div className="result-chart-legend">
        <span className="legend-item">
          <span className="legend-dot main" /> {t.chartWpm}
        </span>
        <span className="legend-item">
          <span className="legend-dot raw" /> {t.rawWpm}
        </span>
        <span className="legend-item">
          <span className="legend-dot err" /> {t.chartErrors}
        </span>
        {hovered && (
          <span className="chart-hover-readout">
            {hovered.sec}
            {t.chartSecSuffix} — <strong>{Math.round(hovered.wpm)} wpm</strong> ·{" "}
            {t.chartRaw} {Math.round(hovered.raw)} · {hovered.errors}{" "}
            {t.chartErrors}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="result-chart-svg"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Horizontal grid lines */}
        {yTicks.map((t) => {
          const y = getY(t);
          return (
            <g key={t}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="var(--sub-alt)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fill="var(--sub)"
                fontSize="10"
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {samples.map((s, i) => {
          if (i % xStep !== 0 && i !== samples.length - 1) return null;
          const x = getX(i);
          return (
            <text
              key={s.sec}
              x={x}
              y={height - 6}
              textAnchor="middle"
              fill="var(--sub)"
              fontSize="10"
            >
              {s.sec}s
            </text>
          );
        })}

        {/* Area fill under WPM line */}
        {areaPoints && (
          <polygon points={areaPoints} fill="var(--main)" fillOpacity="0.08" />
        )}

        {/* Raw WPM dashed polyline */}
        {samples.length > 1 && (
          <polyline
            fill="none"
            stroke="var(--sub)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.65"
            points={rawPoints}
          />
        )}

        {/* Main WPM polyline */}
        {samples.length > 1 && (
          <polyline
            fill="none"
            stroke="var(--main)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={wpmPoints}
          />
        )}

        {/* Data points & Error markers */}
        {samples.map((s, i) => {
          const x = getX(i);
          const yWpm = getY(s.wpm);
          const isHovered = hoverIdx === i;
          return (
            <g key={s.sec}>
              {isHovered && (
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + plotH}
                  stroke="var(--sub)"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}
              <circle
                cx={x}
                cy={yWpm}
                r={isHovered ? 4 : 2.5}
                fill="var(--main)"
              />
              {s.errors > 0 && (
                <circle
                  cx={x}
                  cy={yWpm}
                  r={4.2}
                  fill="var(--error)"
                />
              )}
              {/* Invisible hover column */}
              <rect
                x={x - plotW / Math.max(2, samples.length) / 2}
                y={padTop}
                width={plotW / Math.max(1, samples.length)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
