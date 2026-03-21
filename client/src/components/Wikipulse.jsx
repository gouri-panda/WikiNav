/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function Wikipulse() {
  const [data, setData] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const svgRef = useRef();

  useEffect(() => {
    fetch(
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/India/daily/2025010100/2025030100"
    )
      .then((res) => res.json())
      .then((res) => {
        const items = res.items || [];
        setData(items);

        const map = {};

        items.forEach((d) => {
          const key = `${d.timestamp.slice(0, 4)}-${d.timestamp.slice(4, 6)}`;
          if (!map[key]) map[key] = 0;
          map[key] += d.views;
        });

        const result = Object.entries(map)
          .map(([k, v]) => ({
            month: k,
            views: v,
          }))
          .sort((a, b) => new Date(a.month) - new Date(b.month));

        setMonthly(result);
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

    const width = 500;
    const height = 500;

    const centerX = width / 2;
    const centerY = height / 2;

    const g = svg
      .append("g")
      .attr("transform", `translate(${centerX}, ${centerY})`);

    const values = data.map((d) => d.views);
    const min = d3.min(values) || 0;
    const max = d3.max(values) || 1;

    const colorScale = d3
      .scaleLinear()
      .domain([0, 0.5, 1])
      .range(["#e8f1ff", "#6ba6ff", "#0b57d0"]);

    const normalize = (v) => (v - min) / (max - min || 1);

    const angleStep = 0.22;
    const daysPerWeek = 7;

    const weeks = [];
    for (let i = 0; i < data.length; i += daysPerWeek) {
      weeks.push(data.slice(i, i + daysPerWeek));
    }

    weeks.forEach((week, weekIndex) => {
      const t = weekIndex / weeks.length;

      const baseRadius = 10 + t * 200;
      const thickness = 12;

      const startAngle = weekIndex * angleStep * daysPerWeek;
      const endAngle = startAngle + angleStep * daysPerWeek;

      week.forEach((d, i) => {
        const innerR = baseRadius + (i / daysPerWeek) * thickness;
        const outerR = baseRadius + ((i + 1) / daysPerWeek) * thickness;

        const n = normalize(d.views);

        const arc = d3.arc()
          .innerRadius(innerR)
          .outerRadius(outerR)
          .startAngle(startAngle)
          .endAngle(endAngle);

        g.append("path")
          .attr("d", arc)
          .attr("fill", colorScale(n));
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
          <svg ref={svgRef} width={500} height={500} />
        </div>
      </div>
    </div>
  );
}