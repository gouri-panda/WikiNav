/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const width = 800;
const height = 400;

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

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.date))
      .range([0, width])
      .padding(0.2);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.views)])
      .range([height, 0]);

    const g = svg.append("g");

    g.selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.date))
      .attr("y", (d) => y(d.views))
      .attr("width", x.bandwidth())
      .attr("height", (d) => height - y(d.views))
      .attr("fill", "#4f46e5");
  }, [data]);

  return (
    <div>
      <h2>Pageviews</h2>
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
}