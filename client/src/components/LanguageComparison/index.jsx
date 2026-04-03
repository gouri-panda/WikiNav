/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { useSearchState } from '../../searchStateContext';
import useSources from '../../hooks/useSources';
import useDestinations from '../../hooks/useDestinations';
import useTitleinLanguages from '../../hooks/useTitleInLanguages';
import useClickstreamMetadata from '../../hooks/useClickstreamMetadata';
import Select from 'react-select';
import Toggle from 'react-toggle';
import MultiSelect from './MultiSelect';
import Loader from '../Loader';
import BarChartContainer from './BarChartContainer';
import { directions } from '../../utils';
import Error from '../Error';

const limitOptions = [
  { value: 10, label: 'top 10' },
  { value: 20, label: 'top 20' },
];

export const getLanguageValues = (languages) =>
  languages?.map(({ value }) => value);

const LanguageComparison = () => {
    const [downloadTypeIncoming, setDownloadTypeIncoming] = useState('png');
    const [downloadTypeOutgoing, setDownloadTypeOutgoing] = useState('png');
    const incomingRef = useRef();
    const outgoingRef = useRef();

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
  const { languages } = metadata ?? {};
  const {
    isLoading: isTitleInLanguagesLoading,
    isError: isTitleInLanguagesError,
    data: titleInLanguages,
  } = useTitleinLanguages(language, title, getLanguageValues(languages));
  const [selectedOptions, setSelectedOptions] = useState();
  const [limit, setLimit] = useState(10);
  const [showRealNumbers, setShowRealNumbers] = useState(false);

  useEffect(() => setSelectedOptions([]), [language, title]);

  if (isSourcesLoading || isDestinationsLoading || isTitleInLanguagesLoading) {
    return <Loader />;
  }

  if (isSourcesError || isDestinationsError || isTitleInLanguagesError) {
    return <Error />;
  }

  const titleInLanguage = titleInLanguages && new Map(titleInLanguages);
  const fixedLanguage = languages.find(({ value }) => value === language);
  fixedLanguage.isFixed = true;
  let otherLanguages = languages.filter(({ value }) => value !== language);
  otherLanguages = otherLanguages.map((language) => ({
    ...language,
    isFixed: false,
  }));

  const handleLanguageSelection = (selectedLanguage) => {
    setSelectedOptions([
      ...selectedOptions,
      {
        language: selectedLanguage,
        title: titleInLanguage.get(selectedLanguage),
      },
    ]);
  };

  const handleLanguageRemoval = (removedLanguages) => {
    const updatedOptions = selectedOptions.filter(
      ({ language }) =>
        !removedLanguages.find(({ value }) => value === language)
    );
    setSelectedOptions(updatedOptions);
  };

  return (
    <>
      <div className="language-select">
        <MultiSelect
          fixed={fixedLanguage}
          handleSelection={handleLanguageSelection}
          handleRemoval={handleLanguageRemoval}
          options={otherLanguages}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="subsection-text" style={{ margin: 0 }}>Incoming Pageviews</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Toggle
            className="toggle"
            id="show-real-numbers-lang"
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
            onClick={() => handleDownload(incomingRef, downloadTypeIncoming, 'language-comparison-incoming')}
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
          <BarChartContainer
            ref={incomingRef}
            language={language}
            direction={directions.SOURCES}
            clickstream={sources}
            selectedOptions={selectedOptions}
            limit={limit}
            showRealNumbers={showRealNumbers}
          />
        </div>
        <div className="barchart-label">{showRealNumbers ? 'Incoming Pageviews' : 'Percentage of Incoming Pageviews'}</div>
      </div>
      <h3 className="subsection-text">Outgoing Pageviews</h3>
      <div className="comparison-container">
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, margin: '8px 0 4px 0' }}>
          <button
            onClick={() => handleDownload(outgoingRef, downloadTypeOutgoing, 'language-comparison-outgoing')}
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
          <BarChartContainer
            ref={outgoingRef}
            language={language}
            direction={directions.DESTINATIONS}
            clickstream={destinations}
            selectedOptions={selectedOptions}
            limit={limit}
            showRealNumbers={showRealNumbers}
          />
        </div>
        <div className="barchart-label">{showRealNumbers ? 'Outgoing Pageviews' : 'Percentage of Outgoing Pageviews'}</div>
      </div>
    </>
  );
};

export default LanguageComparison;
