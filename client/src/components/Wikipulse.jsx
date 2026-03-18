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

    const max = d3.max(data, (d) => d.views) || 1;

    const rScale = d3.scaleLinear().domain([0, max]).range([5, 20]);

    const colorScale = d3
      .scaleLinear()
      .domain([0, max])
      .range(["#cfe8ff", "#1a73e8"]);

    const angleStep = 0.25;

    data.forEach((d, i) => {
      const angle = i * angleStep;
      const spiralRadius = i * 3;

      const x = Math.cos(angle) * spiralRadius;
      const y = Math.sin(angle) * spiralRadius;

      g.append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", rScale(d.views))
        .attr("fill", colorScale(d.views))
        .attr("opacity", 0.85);
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