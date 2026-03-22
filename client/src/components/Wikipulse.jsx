/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const baseURL =
  "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article";

function getDayOfYear(ts) {
  const y = ts.slice(0, 4);
  const m = ts.slice(4, 6);
  const d = ts.slice(6, 8);
  const date = new Date(`${y}-${m}-${d}`);
  const start = new Date(`${y}-01-01`);
  return Math.floor((date - start) / (1000 * 60 * 60 * 24)) + 1;
}

export default function Wikipulse() {
  const [data, setData] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const svgRef = useRef();

  useEffect(() => {
    fetch(
      `${baseURL}/en.wikipedia/all-access/user/India/daily/2022010100/2025123100`
    )
      .then((res) => res.json())
      .then((res) => {
        const items = res.items || [];

        const processed = items.map((d) => ({
          views: d.views,
          timestamp: d.timestamp,
          dayOfYear: getDayOfYear(d.timestamp),
          year: d.timestamp.slice(0, 4),
        }));

        setData(processed);

        const map = {};
        items.forEach((d) => {
          const key = `${d.timestamp.slice(0, 4)}-${d.timestamp.slice(4, 6)}`;
          if (!map[key]) map[key] = 0;
          map[key] += d.views;
        });

        setMonthly(
          Object.entries(map)
            .map(([k, v]) => ({ month: k, views: v }))
            .sort((a, b) => new Date(a.month) - new Date(b.month))
        );
      })
      .catch(() => {
        setData([]);
        setMonthly([]);
      });
  }, []);

  useEffect(() => {
    if (!data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 600;
    const height = 600;

    const g = svg
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const values = data.map((d) => d.views);
    const min = d3.min(values);
    const max = d3.max(values);

    const normalize = (v) => (v - min) / (max - min || 1);

    const colorScale = d3
      .scaleLinear()
      .domain([0, 0.5, 1])
      .range(["#eae4f7", "#2e8fb8", "#0b1a48"]);

    const daysPerWeek = 7;

    const sorted = [...data].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.dayOfYear - b.dayOfYear;
    });

    const weeks = [];
    for (let i = 0; i < sorted.length; i += daysPerWeek) {
      weeks.push(sorted.slice(i, i + daysPerWeek));
    }

    const total = weeks.length;

    weeks.forEach((week, i) => {
      const t = i / total;

      const baseRadius = 20 + t * 250;
      const thickness = 10;

      const startAngle = t * Math.PI * 10;
      const endAngle = startAngle + 0.4;

      week.forEach((d, j) => {
        const inner = baseRadius + (j / daysPerWeek) * thickness;
        const outer = baseRadius + ((j + 1) / daysPerWeek) * thickness;

        const arc = d3
          .arc()
          .innerRadius(inner)
          .outerRadius(outer)
          .startAngle(startAngle)
          .endAngle(endAngle);

        g.append("path")
          .attr("d", arc)
          .attr("fill", colorScale(normalize(d.views)));
      });
    });
  }, [data]);

  return (
    <div className="wikipulse-wrapper">
      <div className="wikipulse-grid">
        <div className="wikipulse-left">
          <div className="wikipulse-header">
            <h2 className="wikipulse-title">WikiPulse</h2>
          </div>

          <div>
            {monthly.map((m, i) => (
              <div key={i}>
                {m.month} - {m.views}
              </div>
            ))}
          </div>
        </div>

        <div className="wikipulse-right">
          <svg ref={svgRef} width={600} height={600} />
        </div>
      </div>
    </div>
  );
}