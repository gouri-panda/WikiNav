/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function Wikipulse() {
  const [data, setData] = useState([]);
  const svgRef = useRef();

  useEffect(() => {
    fetch(
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/India/daily/2025010100/2025012000"
    )
      .then((res) => res.json())
      .then((res) => {
        setData(res.items || []);
      });
  }, []);

  useEffect(() => {
    if (!data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 500;
    const height = 500;

    const g = svg
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const max = d3.max(data, (d) => d.views) || 1;

    const rScale = d3.scaleLinear().domain([0, max]).range([10, 180]);

    const angleStep = (Math.PI * 2) / data.length;

    data.forEach((d, i) => {
      const angle = i * angleStep;
      const baseR = rScale(d.views);
      const spiralOffset = i * 1.5;

      const r = baseR + spiralOffset;

      g.append("circle")
        .attr("cx", Math.cos(angle) * r)
        .attr("cy", Math.sin(angle) * r)
        .attr("r", 2)
        .attr("fill", "#1a73e8");
    });
  }, [data]);

  return (
    <div>
      <h2>WikiPulse</h2>
      <svg ref={svgRef} width={500} height={500} />
    </div>
  );
}