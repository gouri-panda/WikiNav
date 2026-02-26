/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const width = 800;
const height = 400;
const margin = { top: 20, right: 20, bottom: 60, left: 50 };

export default function PageViews() {
  const [data, setData] = useState([]);
  const svgRef = useRef();

  useEffect(() => {
    fetch(
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/India/daily/2026010100/2026011500"
    )
      .then((res) => res.json())
      .then((res) => {
        const items = res.items || [];

        const formatted = items.map((d) => ({
          date: `${d.timestamp.slice(0, 4)}-${d.timestamp.slice(
            4,
            6
          )}-${d.timestamp.slice(6, 8)}`,
          views: d.views,
        }));

        setData(formatted);
      });
  }, []);

  useEffect(() => {
    if (!data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.date))
      .range([0, innerWidth])
      .padding(0.2);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.views)])
      .nice()
      .range([innerHeight, 0]);

    g.selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.date))
      .attr("y", (d) => y(d.views))
      .attr("width", x.bandwidth())
      .attr("height", (d) => innerHeight - y(d.views))
      .attr("fill", "#4f46e5");

    g.append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(x).tickValues(x.domain().filter((d, i) => i % 3 === 0)))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    g.append("g").call(d3.axisLeft(y));
  }, [data]);

  return (
    <div>
      <h2>Pageviews</h2>
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
}