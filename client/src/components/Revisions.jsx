/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const width = 900;
const height = 500;

export default function Revisions() {
  const svgRef = useRef();
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const data = [
      { id: "en", size: 100 },
      { id: "fr", size: 60 },
      { id: "de", size: 80 },
    ];

    const centerX = width / 2;
    const centerY = height / 2;

    const maxSize = d3.max(data, (d) => d.size) || 1;
    const rScale = d3.scaleSqrt().domain([0, maxSize]).range([10, 50]);

    const nodes = data.map((d, i) => {
      const angle = (i / data.length) * Math.PI * 2;
      return {
        ...d,
        x: centerX + Math.cos(angle) * 140,
        y: centerY + Math.sin(angle) * 140,
        r: rScale(d.size),
      };
    });

    const g = svg.append("g");

    g.selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
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
      .text((d) => d.id);
  }, [language]);

  return (
    <div>
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value="en">en</option>
        <option value="fr">fr</option>
        <option value="de">de</option>
      </select>

      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
}