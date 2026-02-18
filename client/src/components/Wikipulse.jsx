/* eslint-disable */
import React, { useEffect, useState } from "react";

export default function Wikipulse() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/India/daily/2025010100/2025012000"
    )
      .then((res) => res.json())
      .then((res) => {
        setData(res.items || []);
      });
  }, []);

  return (
    <div>
      <h2>WikiPulse</h2>
      <div>{data.length} points</div>
    </div>
  );
}