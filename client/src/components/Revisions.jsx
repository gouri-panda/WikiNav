/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const width = 900;
const baseHeight = 400;
const extraHeightPerNode = 20;

export default function Revisions() {
  const svgRef = useRef();
  const [language, setLanguage] = useState("en");
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  useEffect(() => {
    setLoading(true);

    fetch(
      `https://wikimedia.org/api/rest_v1/metrics/edits/per-page/${language}.wikipedia/all-editor-types/content/India/monthly/2024010100/2024123100`
    )
      .then((res) => res.json())
      .then((res) => {
        const items = res.items || [];

        const mapped = items.map((d, i) => ({
          id: i,
          label: d.timestamp,
          size: d.edits,
        }));

        setData(mapped.slice(-12));
        setLoading(false);
      })
      .catch(() => {
        setData([]);
        setLoading(false);
      });
  }, [language, period]);

  useEffect(() => {
    if (!loading) drawChart();
  }, [data, loading]);

  const chartHeight =
    baseHeight + Math.max(0, data.length - 8) * extraHeightPerNode;

  const drawChart = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (!data.length) return;

    const centerX = width / 2;
    const centerY = chartHeight / 2;

    const maxSize = d3.max(data, (d) => d.size) || 1;
    const rScale = d3.scaleSqrt().domain([0, maxSize]).range([10, 50]);

    const g = svg.append("g");

    drawRings(g, centerX, centerY);
    drawNodes(g, data, centerX, centerY, rScale);
  };

  const drawRings = (g, cx, cy) => {
    [60, 100, 140, 180].forEach((r) => {
      g.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", r)
        .attr("fill", "none")
        .attr("stroke", "#ddd");
    });
  };

  const drawNodes = (g, data, cx, cy, rScale) => {
    const radius = 150;

    const nodes = data.map((d, i) => {
      const angle = (i / data.length) * Math.PI * 2;
      return {
        ...d,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        r: rScale(d.size),
      };
    });

    g.selectAll("circle.node")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r)
      .attr("fill", "#69b3a2");

    g.selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .text((d) => d.label);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="en">en</option>
          <option value="fr">fr</option>
          <option value="de">de</option>
        </select>

        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="30">30d</option>
          <option value="90">90d</option>
          <option value="365">365d</option>
        </select>
      </div>

      {loading && <div>Loading...</div>}

      <svg ref={svgRef} width={width} height={chartHeight} />
    </div>
  );
}