/* eslint-disable */
import React, { useEffect, useState } from "react";

export default function PageViews() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/India/daily/2026010100/2026011000"
    )
      .then((res) => res.json())
      .then((res) => {
        const items = res.items || [];
        setData(items);
      });
  }, []);

  return (
    <div>
      <h2>Pageviews</h2>
      <div>{data.length} days</div>
    </div>
  );
}