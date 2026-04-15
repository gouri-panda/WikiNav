import React, { forwardRef } from 'react';
import useMultipleClickstream from '../../hooks/useMultipleClickstream';
import useTitlesInLanguages from '../../hooks/useTitlesInLanguages';
import HorizontalBar from '../HorizontalBar';
import Loader from '../Loader';
import { getTitles, round, sumClickstream, denormalize } from '../../utils';

const isError = (results) => results.some(({ isError }) => isError);

const isLoading = (results) => results.some(({ isLoading }) => isLoading);

const percentageOfViews = (views, totalViews) =>
  round((views * 100) / totalViews);

const BarChartContainer = forwardRef(({
  language,
  direction,
  clickstream,
  selectedOptions,
  limit = 10,
  showRealNumbers = false,
  onTitleClick,
  totalViews,
  perItemViews,
}, ref) => {
  const limitedClickstream = clickstream?.slice(0, limit);
  const clickstreamViews = totalViews ?? sumClickstream(clickstream);

  // hooks for fetching data
  const clickstreamQueries = selectedOptions.map((option) => ({
    ...option,
    direction,
  }));
  const selectedLanguageClickstream =
    useMultipleClickstream(clickstreamQueries);
  const selectedLanguageTitles = useTitlesInLanguages(
    language,
    getTitles(limitedClickstream),
    selectedOptions.map(({ language }) => language)
  );

  // process fetched data to generate chart data
  const selectedLanguageViews = selectedLanguageClickstream.map(({ data }) =>
    sumClickstream(data)
  );
  const chartData = limitedClickstream.map(({ title, views }, itemIdx) => {
    const translations = { [language]: denormalize(title) };
    const denominator = perItemViews ? perItemViews[itemIdx] : clickstreamViews;
    const dataPoint = {
      title: denormalize(title),
      [language]: showRealNumbers ? (views ?? 0) : percentageOfViews(views, denominator),
    };
    selectedOptions?.forEach(({ language }, idx) => {
      const titleInLanguage = selectedLanguageTitles[idx].data?.find(
        (s) => s.title === title
      )?.langlink;
      translations[language] = denormalize(titleInLanguage ?? title);
      const titleViews = selectedLanguageClickstream[idx].data?.find(
        (s) => s.title === (titleInLanguage ?? title)
      )?.views;
      dataPoint[language] = showRealNumbers
        ? (titleViews ?? 0)
        : percentageOfViews(titleViews, selectedLanguageViews[idx]);
    });
    dataPoint.translations = translations;
    return dataPoint;
  });

  if (
    isLoading(selectedLanguageClickstream) ||
    isLoading(selectedLanguageTitles)
  ) {
    return <Loader />;
  }

  if (isError(selectedLanguageClickstream) || isError(selectedLanguageTitles)) {
    console.log('Error occurred during fetching selected languages...');
  }

  return (
    <HorizontalBar
      ref={ref}
      data={chartData}
      keys={[language, ...selectedOptions?.map(({ language }) => language)]}
      onTitleClick={onTitleClick}
    />
  );
});

export default BarChartContainer;
