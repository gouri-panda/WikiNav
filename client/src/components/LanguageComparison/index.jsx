/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { useSearchState } from '../../searchStateContext';
import useSources from '../../hooks/useSources';
import useDestinations from '../../hooks/useDestinations';
import useTitleinLanguages from '../../hooks/useTitleInLanguages';
import useClickstreamMetadata from '../../hooks/useClickstreamMetadata';
import useMonthlyViews from '../../hooks/useMonthlyViews';
import useMultipleMonthlyViews from '../../hooks/useMultipleMonthlyViews';
import Select from 'react-select';
import Toggle from 'react-toggle';
import MultiSelect from './MultiSelect';
import Loader from '../Loader';
import BarChartContainer from './BarChartContainer';
import CameraDownloadButton from '../CameraDownloadButton';
import { directions, getNonReferrerSources, getTitles, isReferrer, denormalize } from '../../utils';
import Error from '../Error';

const limitOptions = [
  { value: 10, label: 'top 10' },
  { value: 20, label: 'top 20' },
];

export const getLanguageValues = (languages) =>
  languages?.map(({ value }) => value);

const LanguageComparison = () => {
    const incomingRef = useRef();
    const outgoingRef = useRef();

    const handleDownload = (ref, filename) => {
      const svg = ref.current?.getSVG();
      if (!svg) return;
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
    };
  const [{ language, title }, onClick] = useSearchState();
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
  const [year, month] = metadata?.month.split('-') ?? [];
  const { languages } = metadata ?? {};
  const {
    isLoading: isTitleInLanguagesLoading,
    isError: isTitleInLanguagesError,
    data: titleInLanguages,
  } = useTitleinLanguages(language, title, getLanguageValues(languages));
  const {
    isLoading: isMonthlyViewsLoading,
    isError: isMonthlyViewsError,
    data: titleMonthlyViews,
  } = useMonthlyViews(language, title, month, year);
  const destinationsMonthlyViews = useMultipleMonthlyViews(
    language,
    getTitles(destinations?.slice(0, 20)),
    month,
    year
  );
  const isDestMonthlyViewsLoading = destinationsMonthlyViews.some(({ isLoading }) => isLoading);
  const isDestMonthlyViewsError = destinationsMonthlyViews.some(({ isError }) => isError);
  const [selectedOptions, setSelectedOptions] = useState();
  const [limit, setLimit] = useState(10);
  const [showRealNumbers, setShowRealNumbers] = useState(false);
  const [includeOther, setIncludeOther] = useState(true);

  useEffect(() => setSelectedOptions([]), [language, title]);

  if (isSourcesLoading || isDestinationsLoading || isTitleInLanguagesLoading || isMonthlyViewsLoading || isDestMonthlyViewsLoading) {
    return <Loader />;
  }

  if (isSourcesError || isDestinationsError || isTitleInLanguagesError || isMonthlyViewsError || isDestMonthlyViewsError) {
    return <Error />;
  }

  const titleInLanguage = titleInLanguages && new Map(titleInLanguages);
  const fixedLanguage = {
    ...languages.find(({ value }) => value === language),
    label: `${language}.wikipedia.org – ${denormalize(title)}`,
    isFixed: true,
  };
  let otherLanguages = languages
    .filter(({ value }) => value !== language && titleInLanguage?.has(value))
    .map((lang) => ({
      ...lang,
      label: `${lang.label} – ${denormalize(titleInLanguage.get(lang.value))}`,
      isFixed: false,
    }));

  const handleTitleClick = (clickedTitle) => {
    const normalized = clickedTitle.replaceAll(' ', '_');
    if (!isReferrer(normalized)) {
      onClick('title', normalized);
    }
  };

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
          selected={selectedOptions?.map(({ language }) => language)}
        />
        {otherLanguages.length === 0 && (
          <p className="paragraph" style={{ marginTop: 8, color: '#888' }}>
            No other language editions with clickstream data are available for this article.
          </p>
        )}
      </div>
      <div className="sankey-controls">
        <div>
          <Toggle
            className="toggle"
            id="include-other-lang"
            defaultChecked={includeOther}
            icons={false}
            onChange={() => setIncludeOther(!includeOther)}
          />
          <span className="toggle-label">
            Include views from sources other than Wiki articles
          </span>
        </div>
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
      <h3 className="subsection-text">Incoming Pageviews</h3>
      <div className="comparison-container chart-download-wrapper">
        <CameraDownloadButton onClick={() => handleDownload(incomingRef, 'comparison_across_languages_incoming')} />
        <div className="barchart">
          <BarChartContainer
            ref={incomingRef}
            language={language}
            direction={directions.SOURCES}
            clickstream={includeOther ? sources : getNonReferrerSources(sources)}
            selectedOptions={selectedOptions}
            limit={limit}
            showRealNumbers={showRealNumbers}
            onTitleClick={handleTitleClick}
            totalViews={titleMonthlyViews}
          />
        </div>
        <div className="barchart-label">{showRealNumbers ? 'Incoming Pageviews' : 'Percentage of Incoming Pageviews'}</div>
      </div>
      <h3 className="subsection-text">Outgoing Pageviews</h3>
      <div className="comparison-container chart-download-wrapper">
        <CameraDownloadButton onClick={() => handleDownload(outgoingRef, 'comparison_across_languages_outgoing')} />
        <div className="barchart">
          <BarChartContainer
            ref={outgoingRef}
            language={language}
            direction={directions.DESTINATIONS}
            clickstream={destinations}
            selectedOptions={selectedOptions}
            limit={limit}
            showRealNumbers={showRealNumbers}
            onTitleClick={handleTitleClick}
            perItemViews={destinationsMonthlyViews.map(({ data }) => data)}
          />
        </div>
        <div className="barchart-label">{showRealNumbers ? 'Outgoing Pageviews' : 'Percentage of Outgoing Pageviews'}</div>
      </div>
    </>
  );
};

export default LanguageComparison;
