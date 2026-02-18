/* eslint-disable */
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const width = 900;
const height = 500;

export default function Revisions() {
  const svgRef = useRef();

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

    const nodes = data.map((d, i) => {
      const angle = (i / data.length) * Math.PI * 2;
      return {
        ...d,
        x: centerX + Math.cos(angle) * 120,
        y: centerY + Math.sin(angle) * 120,
        r: d.size / 5,
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
  }, []);

  return <svg ref={svgRef} width={width} height={height} />;
}