/* eslint-disable */
import React, { useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import Select from 'react-select';
import { useQuery } from 'react-query';
import { useSearchState } from '../searchStateContext';
import { denormalize, kFormatter } from '../utils';
import { fetchDailyViews } from '../services/pageviews';
import { fetchTitleInLanguages } from '../services/langlinks';
import Loader from './Loader';
import Error from './Error';

const rangeOptions = [
	{ value: '30', label: 'Last 30 days' },
	{ value: '90', label: 'Last 90 days' },
	{ value: '180', label: 'Last 180 days' },
	{ value: 'custom', label: 'Custom range' },
];

const toDateInputValue = (date) => date.toISOString().slice(0, 10);

const getYesterday = () => {
	const date = new Date();
	date.setDate(date.getDate() - 1);
	return date;
};

const getPresetStartDate = (days, endDate) => {
	const date = new Date(endDate);
	date.setDate(date.getDate() - (days - 1));
	return toDateInputValue(date);
};

const formatTickDate = (dateString) => {
	const date = new Date(`${dateString}T00:00:00`);
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
	});
};

const getTickStep = (count) => {
	if (count <= 35) {
		return 1;
	}

	return Math.ceil(count / 35);
};

const buildLanguageLabel = (code, localizedTitle, isCurrent = false) => {
	const readableTitle = localizedTitle ? denormalize(localizedTitle) : '';
	const titleSuffix = readableTitle ? ` - ${readableTitle}` : '';
	return `${code}.wikipedia.org${titleSuffix}${isCurrent ? ' (current)' : ''}`;
};

const PageViews = () => {
const [{ language, title }] = useSearchState();
const [selectedRange, setSelectedRange] = useState(rangeOptions[1].value);
const [selectedLanguage, setSelectedLanguage] = useState(language);
const [downloadType, setDownloadType] = useState('png');
const plotRef = React.useRef();

	const defaultEndDate = toDateInputValue(getYesterday());
	const defaultStartDate = getPresetStartDate(90, defaultEndDate);

	const [customStartDate, setCustomStartDate] = useState(defaultStartDate);
	const [customEndDate, setCustomEndDate] = useState(defaultEndDate);

	useEffect(() => {
		setSelectedLanguage(language);
		setSelectedRange(rangeOptions[1].value);
		setCustomStartDate(defaultStartDate);
		setCustomEndDate(defaultEndDate);
	}, [language, title]);

	const {
		isLoading: isLanguageTitlesLoading,
		isError: isLanguageTitlesError,
		data: titleInLanguages,
	} = useQuery(
		['pageviewsTitleInLanguages', language, title],
		() => fetchTitleInLanguages(language, title),
		{ staleTime: Infinity, enabled: !!(language && title) }
	);

	const titleInLanguageMap = useMemo(
		() => new Map(titleInLanguages ?? []),
		[titleInLanguages]
	);

	const languageOptions = useMemo(() => {
		const options = [
			{
				value: language,
				label: buildLanguageLabel(language, title, true),
			},
		];

		const linkedLanguageOptions = Array.from(titleInLanguageMap.keys())
			.filter((code) => code !== language)
			.sort((a, b) => a.localeCompare(b))
			.map((code) => ({
				value: code,
				label: buildLanguageLabel(code, titleInLanguageMap.get(code)),
			}));

		return options.concat(linkedLanguageOptions);
	}, [language, title, titleInLanguageMap]);

	useEffect(() => {
		const exists = languageOptions.some(({ value }) => value === selectedLanguage);
		if (!exists) {
			setSelectedLanguage(language);
		}
	}, [language, languageOptions, selectedLanguage]);

	const selectedLanguageTitle =
		selectedLanguage === language
			? title
			: titleInLanguageMap.get(selectedLanguage);

	const selectedOption =
		languageOptions.find(({ value }) => value === selectedLanguage) ??
		languageOptions[0];

	const startDate =
		selectedRange === 'custom'
			? customStartDate
			: getPresetStartDate(parseInt(selectedRange, 10), defaultEndDate);
	const endDate = selectedRange === 'custom' ? customEndDate : defaultEndDate;

	const hasValidDateRange = !!(startDate && endDate && startDate <= endDate);

	const {
		isLoading: isDailyViewsLoading,
		isError: isDailyViewsError,
		data: dailyViews,
	} = useQuery(
		[
			'dailyViews',
			selectedLanguage,
			selectedLanguageTitle,
			startDate,
			endDate,
			selectedRange,
		],
		() => fetchDailyViews(selectedLanguage, selectedLanguageTitle, startDate, endDate),
		{
			enabled: !!(selectedLanguageTitle && hasValidDateRange),
			keepPreviousData: true,
		}
	);

	if (isLanguageTitlesLoading) {
		return <Loader />;
	}

	if (isLanguageTitlesError || isDailyViewsError) {
		return <Error />;
	}

	const totalViews = dailyViews?.reduce((sum, item) => sum + item.views, 0) ?? 0;
	const averageViews = dailyViews?.length
		? Math.round(totalViews / dailyViews.length)
		: 0;
	const dayLabels = dailyViews?.map(({ date }) => date) ?? [];
	const tickStep = getTickStep(dayLabels.length);
	const tickDates = dayLabels.filter(
		(date, index) => index % tickStep === 0 || index === dayLabels.length - 1
	);
	const tickTexts = tickDates.map((date) => formatTickDate(date));

	return (
		<div className="pageviews-container">
			<div className="pageviews-toolbar">
				<div className="pageviews-control-group">
					<label className="revisions-period-label" htmlFor="pageviews-language">
						Article language
					</label>
					<Select
						inputId="pageviews-language"
						className="pageviews-select"
						value={selectedOption}
						onChange={(option) => setSelectedLanguage(option.value)}
						options={languageOptions}
						noOptionsMessage={() => null}
						maxMenuHeight={200}
						theme={(theme) => ({
							...theme,
							colors: {
								...theme.colors,
								neutral50: 'black',
							},
						})}
					/>
				</div>

				<div className="pageviews-control-group">
					<label className="revisions-period-label" htmlFor="pageviews-range">
						Time range
					</label>
					<select
						id="pageviews-range"
						className="revisions-period-select"
						value={selectedRange}
						onChange={(event) => setSelectedRange(event.target.value)}
					>
						{rangeOptions.map(({ value, label }) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</div>

				{selectedRange === 'custom' ? (
					<div className="revisions-custom-range pageviews-custom-range">
						<input
							className="revisions-date-input"
							type="date"
							value={customStartDate}
							max={customEndDate}
							onChange={(event) => setCustomStartDate(event.target.value)}
						/>
						<span>to</span>
						<input
							className="revisions-date-input"
							type="date"
							value={customEndDate}
							max={defaultEndDate}
							min={customStartDate}
							onChange={(event) => setCustomEndDate(event.target.value)}
						/>
					</div>
				) : null}
			</div>

			<div className="overview-container pageviews-summary margin-top-3">
				<div className="overview-card">
					<div className="overview-figure">{kFormatter(totalViews)}</div>
					<span>Total views</span>
				</div>
				<div className="overview-card">
					<div className="overview-figure">{kFormatter(averageViews)}</div>
					<span>Average per day</span>
				</div>
				<div className="overview-card">
					<div className="overview-figure">{dailyViews?.length ?? 0}</div>
					<span>Days shown</span>
				</div>
			</div>

			<p className="paragraph">
				Showing daily pageviews for <strong>{denormalize(selectedLanguageTitle || title)}</strong>{' '}
				on <strong>{selectedLanguage}.wikipedia.org</strong> from{' '}
				<strong>{startDate}</strong> to <strong>{endDate}</strong>.
			</p>

			{!hasValidDateRange ? (
				<div className="error-container">Choose a valid date range to view data.</div>
			) : null}

			{isDailyViewsLoading ? <Loader /> : null}

			{!isDailyViewsLoading && hasValidDateRange && !dailyViews?.length ? (
				<div className="error-container">No pageviews found for this language and date range.</div>
			) : null}

			{!isDailyViewsLoading && dailyViews?.length ? (
				<>
					<div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, margin: '8px 0 4px 0' }}>
						<button
							onClick={async () => {
								if (!plotRef.current) return;
								const format = downloadType;
								const dataUrl = await window.Plotly.toImage(plotRef.current, { format, width: 900, height: 400, scale: 2 });
								const a = document.createElement('a');
								a.href = dataUrl;
								a.download = `pageviews.${format}`;
								a.click();
							}}
							className="sankey-download-button"
							title={`Download as ${downloadType.toUpperCase()}`}
						>
							Download
						</button>
						<button
							type="button"
							className="sankey-download-button"
							style={{ minWidth: 80, fontSize: 14, fontWeight: 600, padding: '10px 18px' }}
							aria-pressed={downloadType === 'svg'}
							onClick={() => setDownloadType(downloadType === 'png' ? 'svg' : 'png')}
							title={downloadType === 'png' ? 'Switch to SVG' : 'Switch to PNG'}
						>
							{downloadType === 'png' ? 'PNG' : 'SVG'}
						</button>
					</div>
					<div className="pageviews-chart">
						<Plot
							ref={plotRef}
							data={[
								{
									type: 'bar',
									x: dayLabels,
									y: dailyViews.map(({ views }) => views),
									marker: {
										color: '#a6cee3',
									},
									hovertemplate: '<b>%{x}</b><br>%{y} views<extra></extra>',
								},
							]}
							layout={{
								autosize: true,
								margin: {
									l: 60,
									r: 10,
									t: 10,
									b: 80,
								},
								xaxis: {
									tickangle: -45,
									tickmode: 'array',
									tickvals: tickDates,
									ticktext: tickTexts,
									automargin: true,
									title: {
										text: 'Date',
									},
								},
								yaxis: {
									title: { text: 'Pageviews' },
								},
								paper_bgcolor: 'rgba(0,0,0,0)',
								plot_bgcolor: '#f2f9fe',
								bargap: 0.15,
								showlegend: false,
							}}
							config={{
								displaylogo: false,
								modeBarButtonsToRemove: [
									'lasso2d',
									'select2d',
									'hoverClosestCartesian',
									'hoverCompareCartesian',
									'autoScale2d',
								],
								responsive: true,
							}}
							useResizeHandler
							style={{ width: '100%', height: '100%' }}
						/>
					</div>
				</>
			) : null}
				</div>
			
	);
};

export default PageViews;
