/* eslint-disable */
import React, { useEffect, useState } from "react";

export default function PageViews() {
  const [data, setData] = useState([]);

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

  return (
    <div>
      <h2>Pageviews</h2>

      <ul>
        {data.slice(0, 5).map((d, i) => (
          <li key={i}>
            {d.date} - {d.views}
          </li>
        ))}
      </ul>
    </div>
  );
}