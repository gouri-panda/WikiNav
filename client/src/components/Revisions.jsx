/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const width = 1000;
const height = 500;

export default function Revisions() {
  const svgRef = useRef();

  const [selected, setSelected] = useState(["enwiki"]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  async function fetchLanguage(lang) {
    try {
      const code = lang.replace("wiki", "");

      const res = await fetch(
        `https://${code}.wikipedia.org/w/api.php?action=query&prop=revisions&titles=India&rvprop=size|tags&rvlimit=50&format=json&origin=*`
      );

      const json = await res.json();
      const page = Object.values(json.query?.pages || {})[0] || {};
      const revs = page.revisions || [];

      return {
        lang,
        revisions: revs.length,
        reverts: revs.filter((r) =>
          r.tags?.includes("mw-reverted")
        ).length,
        size: revs[0]?.size || 0,
        revertSize:
          (revs[0]?.size || 0) - (revs[1]?.size || revs[0]?.size || 0),
      };
    } catch {
      return null;
    }
  }

  async function loadData() {
    setLoading(true);

    const results = await Promise.all(
      selected.map((lang) => fetchLanguage(lang))
    );

    setData(results.filter(Boolean));
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [selected]);

  useEffect(() => {
    if (!data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const centerX = width / 2;
    const centerY = height / 2;

    const maxSize = d3.max(data, (d) => d.size) || 1;

    const rScale = d3.scaleSqrt()
      .domain([0, maxSize])
      .range([30, 90]);

    const nodes = data.map((d) => ({
      ...d,
      r: rScale(d.size),
    }));

    const g = svg.append("g");

    const node = g.selectAll("g")
      .data(nodes)
      .enter()
      .append("g");

    node.append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", "#6e8595");

    node.append("text")
      .text((d) => d.lang)
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .style("fill", "white");

    const simulation = d3.forceSimulation(nodes)
      .force("center", d3.forceCenter(centerX, centerY))
      .force("collision", d3.forceCollide().radius(d => d.r + 5))
      .on("tick", () => {
        node.attr("transform", d => `translate(${d.x},${d.y})`);
      });

    return () => simulation.stop();

  }, [data]);

  return (
    <div>
      <h2>Revisions</h2>

      <button onClick={() => setSelected(["enwiki", "frwiki"])}>
        Compare
      </button>

      {loading && <div>Loading...</div>}

      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
}