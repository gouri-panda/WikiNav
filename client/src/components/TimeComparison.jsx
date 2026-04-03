/* eslint-disable */
import { useSearchState } from '../searchStateContext';
import useSources from '../hooks/useSources';
import useDestinations from '../hooks/useDestinations';
import useClickstreamMetadata from '../hooks/useClickstreamMetadata';
import Loader from './Loader';
import Error from './Error';
import HorizontalBar from './HorizontalBar';
import React, { useRef, useState } from 'react';
import Select from 'react-select';
import Toggle from 'react-toggle';
import { sumClickstream, round } from '../utils';

const limitOptions = [
  { value: 10, label: 'top 10' },
  { value: 20, label: 'top 20' },
];

const getMonth = (date) => {
  const month = date.getMonth() + 1;
  return month < 10 ? `0${month}` : `${month}`;
};

const percentageOfViews = (views, totalViews) =>
  round((views * 100) / totalViews);

const getPreviousMonth = (month) => {
  const monthParts = month.split('-');
  const latestDate = new Date(monthParts[0], monthParts[1]-1, 15);
  latestDate.setMonth(latestDate.getMonth() - 1);
  return `${latestDate.getFullYear()}-${getMonth(latestDate)}`;
};


const TimeComparison = () => {
  const [downloadTypeIncoming, setDownloadTypeIncoming] = useState('png');
  const [downloadTypeOutgoing, setDownloadTypeOutgoing] = useState('png');
  const [limit, setLimit] = useState(10);
  const [showRealNumbers, setShowRealNumbers] = useState(false);
  const incomingRef = useRef();
  const outgoingRef = useRef();

  const [{ language, title }] = useSearchState();
  const {
    isLoading: isSourcesLoading,
    isError: isSourcesError,
    data: sources,
  } = useSources(language, title);
  const {
    isLoading: isDestinationsLoading,
    isError: isDestinationsError,
    data: destinations,
  } = useDestinations(language, title);
  const { data: metadata } = useClickstreamMetadata();
  const month = metadata?.month;
  const previousMonth = month && getPreviousMonth(month);
  const {
    isLoading: isOldSourcesLoading,
    isError: isOldSourcesError,
    data: oldSources,
  } = useSources(language, title, previousMonth);
  const {
    isLoading: isOldDestinationsLoading,
    isError: isOldDestinationsError,
    data: oldDestinations,
  } = useDestinations(language, title, previousMonth);

  if (
    isSourcesLoading ||
    isDestinationsLoading ||
    isOldSourcesLoading ||
    isOldDestinationsLoading
  ) {
    return <Loader />;
  }

  if (
    isSourcesError ||
    isDestinationsError ||
    isOldSourcesError ||
    isOldDestinationsError
  ) {
    return <Error />;
  }

  const getChartData = (currentClickstream, oldClickstream) => {
    const currentClickstreamViews = sumClickstream(currentClickstream);
    const oldClickstreamViews = sumClickstream(oldClickstream);
    return currentClickstream.slice(0, limit).map(({ title, views }) => {
      const oldViews = oldClickstream.find((c) => c.title === title)?.views;
      if (showRealNumbers) {
        return {
          title,
          [month]: views ?? 0,
          [previousMonth]: oldViews ?? 0,
        };
      }
      return {
        title,
        [month]: percentageOfViews(views, currentClickstreamViews),
        [previousMonth]: percentageOfViews(oldViews, oldClickstreamViews),
      };
    });
  };

  const chartDataIncoming = getChartData(sources, oldSources);
  const chartDataOutgoing = getChartData(destinations, oldDestinations);
  const keys = [month, previousMonth];

  const handleDownload = (ref, type, filename) => {
    const svg = ref.current?.getSVG();
    if (!svg) return;
    if (type === 'svg') {
      const serializer = new XMLSerializer();
      const src = serializer.serializeToString(svg);
      const blob = new Blob([src], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename + '.svg';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const serializer = new XMLSerializer();
      const src = serializer.serializeToString(svg);
      const svg64 = btoa(unescape(encodeURIComponent(src)));
      const image64 = 'data:image/svg+xml;base64,' + svg64;
      const img = new window.Image();
      const width = svg.width.baseVal.value || 900;
      const height = svg.height.baseVal.value || 400;
      img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(function (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename + '.png';
          a.click();
          URL.revokeObjectURL(url);
        }, 'image/png');
      };
      img.src = image64;
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="subsection-text" style={{ margin: 0 }}>Incoming Pageviews</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Toggle
            className="toggle"
            id="show-real-numbers-time"
            defaultChecked={showRealNumbers}
            icons={false}
            onChange={() => setShowRealNumbers(!showRealNumbers)}
          />
          <span className="toggle-label">Show real numbers</span>
        <Select
          className="limit-select"
          options={limitOptions}
          onChange={(o) => setLimit(o.value)}
          defaultValue={limitOptions.find(({ value }) => value === limit)}
          isSearchable={false}
        />
        </div>
      </div>
      <div className="comparison-container">
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, margin: '8px 0 4px 0' }}>
          <button
            onClick={() => handleDownload(incomingRef, downloadTypeIncoming, 'incoming-pageviews')}
            className="sankey-download-button"
            title={`Download as ${downloadTypeIncoming.toUpperCase()}`}
          >
            Download
          </button>
          <button
            type="button"
            className="sankey-download-button"
            style={{ minWidth: 80, fontSize: 14, fontWeight: 600, padding: '10px 18px' }}
            aria-pressed={downloadTypeIncoming === 'svg'}
            onClick={() => setDownloadTypeIncoming(downloadTypeIncoming === 'png' ? 'svg' : 'png')}
            title={downloadTypeIncoming === 'png' ? 'Switch to SVG' : 'Switch to PNG'}
          >
            {downloadTypeIncoming === 'png' ? 'PNG' : 'SVG'}
          </button>
        </div>
        <div className="barchart">
          <HorizontalBar ref={incomingRef} data={chartDataIncoming} keys={keys} />
        </div>
        <p className="barchart-label">{showRealNumbers ? 'Incoming Pageviews' : 'Percentage of Incoming Pageviews'}</p>
      </div>
      <h3 className="subsection-text">Outgoing Pageviews</h3>
      <div className="comparison-container">
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, margin: '8px 0 4px 0' }}>
          <button
            onClick={() => handleDownload(outgoingRef, downloadTypeOutgoing, 'outgoing-pageviews')}
            className="sankey-download-button"
            title={`Download as ${downloadTypeOutgoing.toUpperCase()}`}
          >
            Download
          </button>
          <button
            type="button"
            className="sankey-download-button"
            style={{ minWidth: 80, fontSize: 14, fontWeight: 600, padding: '10px 18px' }}
            aria-pressed={downloadTypeOutgoing === 'svg'}
            onClick={() => setDownloadTypeOutgoing(downloadTypeOutgoing === 'png' ? 'svg' : 'png')}
            title={downloadTypeOutgoing === 'png' ? 'Switch to SVG' : 'Switch to PNG'}
          >
            {downloadTypeOutgoing === 'png' ? 'PNG' : 'SVG'}
          </button>
        </div>
        <div className="barchart">
          <HorizontalBar ref={outgoingRef} data={chartDataOutgoing} keys={keys} />
        </div>
        <p className="barchart-label">{showRealNumbers ? 'Outgoing Pageviews' : 'Percentage of Outgoing Pageviews'}</p>
      </div>
    </>
  );
};

export default TimeComparison;
