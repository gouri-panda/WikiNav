/* eslint-disable */
import React, { useEffect, useMemo, useRef } from 'react';
import Plot from 'react-plotly.js';
import axios from 'axios';
import { useQuery } from 'react-query';
import { useSearchState } from '../searchStateContext';
import { denormalize, kFormatter } from '../utils';
import Loader from './Loader';
import Error from './Error';
import CameraDownloadButton from './CameraDownloadButton';
import * as d3 from 'd3';

const baseURL = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article';

const formatApiDate = (dateString) => dateString.replaceAll('-', '');

const getDayOfYear = (dateString) => {
	const [year, month, day] = [
		dateString.substring(0, 4),
		dateString.substring(4, 6),
		dateString.substring(6, 8),
	];
	const date = new Date(`${year}-${month}-${day}`);
	const start = new Date(`${year}-01-01`);
	const diff = date - start;
	const oneDay = 1000 * 60 * 60 * 24;
	return Math.floor(diff / oneDay) + 1;
};

const fetchYearlyData = async (language, title) => {
	const encodedTitle = encodeURIComponent(title);
	const currentYear = new Date().getFullYear();

	try {
		const years = [currentYear - 3, currentYear - 2, currentYear - 1, currentYear];
		const spiralData = [];

		for (const year of years) {
			const start = `${year}010100`;
			const end = `${year}123100`;
			const url = `${baseURL}/${language}.wikipedia/all-access/user/${encodedTitle}/daily/${start}/${end}`;

			try {
				const response = await axios.get(url);
				const items = response.data.items ?? [];

				items.forEach((item) => {
					spiralData.push({
						year,
						timestamp: item.timestamp,
						dayOfYear: getDayOfYear(item.timestamp),
						views: item.views,
					});
				});
			} catch {
				// Skip if year fails
			}
		}

		return spiralData;
	} catch {
		return [];
	}
};

const fetchWeeklyData = async (language, title) => {
	const encodedTitle = encodeURIComponent(title);
	const endDate = new Date();
	endDate.setDate(endDate.getDate() - 1);
	const startDate = new Date(endDate);
	startDate.setDate(startDate.getDate() - 365);

	const start = `${formatApiDate(startDate.toISOString().slice(0, 10))}00`;
	const end = `${formatApiDate(endDate.toISOString().slice(0, 10))}00`;

	const url = `${baseURL}/${language}.wikipedia/all-access/user/${encodedTitle}/daily/${start}/${end}`;
	try {
		const response = await axios.get(url);
		// Order starting from Monday: JS getDay() 0=Sun,1=Mon,...,6=Sat
		const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
		const jsOrder =  [1, 2, 3, 4, 5, 6, 0]; // maps dayNames index to JS getDay()
		const weeklyAgg = Array(7).fill(0);
		const weeklyCount = Array(7).fill(0);
		(response.data.items ?? []).forEach(({ timestamp, views }) => {
			const date = new Date(`${timestamp.substring(0, 4)}-${timestamp.substring(4, 6)}-${timestamp.substring(6, 8)}`);
			const dayOfWeek = date.getDay();
			weeklyAgg[dayOfWeek] += views;
			weeklyCount[dayOfWeek] += 1;
		});

		return dayNames.map((day, idx) => {
			const jsIdx = jsOrder[idx];
			return {
				day,
				dayNum: idx,
				avgViews: weeklyCount[jsIdx] > 0 ? Math.round(weeklyAgg[jsIdx] / weeklyCount[jsIdx]) : 0,
			};
		});
	} catch {
		return [];
	}
};

const fetchMonthlyTrend = async (language, title) => {
	const encodedTitle = encodeURIComponent(title);
	const endDate = new Date();
	endDate.setDate(endDate.getDate() - 1);
	const startDate = new Date(endDate);
	startDate.setFullYear(startDate.getFullYear() - 3);

	const start = `${formatApiDate(startDate.toISOString().slice(0, 10))}00`;
	const end = `${formatApiDate(endDate.toISOString().slice(0, 10))}00`;

	const url = `${baseURL}/${language}.wikipedia/all-access/user/${encodedTitle}/daily/${start}/${end}`;
	try {
		const response = await axios.get(url);
		const monthlyAgg = {};

		(response.data.items ?? []).forEach(({ timestamp, views }) => {
			const date = `${timestamp.substring(0, 4)}-${timestamp.substring(4, 6)}`;
			if (!monthlyAgg[date]) {
				monthlyAgg[date] = { date, views: 0, count: 0 };
			}
			monthlyAgg[date].views += views;
			monthlyAgg[date].count += 1;
		});

		return Object.values(monthlyAgg).sort((a, b) => a.date.localeCompare(b.date));
	} catch {
		return [];
	}
};

const fetchOverviewStats = async (language, title) => {
	const encodedTitle = encodeURIComponent(title);
	const endDate = new Date();
	endDate.setDate(endDate.getDate() - 1);
	const startDate = new Date(endDate);
	startDate.setMonth(startDate.getMonth() - 1);

	const start = `${formatApiDate(startDate.toISOString().slice(0, 10))}00`;
	const end = `${formatApiDate(endDate.toISOString().slice(0, 10))}00`;

	const url = `${baseURL}/${language}.wikipedia/all-access/user/${encodedTitle}/daily/${start}/${end}`;
	try {
		const response = await axios.get(url);
		const items = response.data.items ?? [];
		const totalViews = items.reduce((sum, item) => sum + item.views, 0);
		const maxDay = items.reduce((max, item) => (item.views > max.views ? item : max), { views: 0 });
		const avgPerDay = items.length > 0 ? Math.round(totalViews / items.length) : 0;

		return {
			totalViews,
			avgPerDay,
			maxDay: `${maxDay.views?.toLocaleString?.() || 0} views`,
			daysTracked: items.length,
		};
	} catch {
		return { totalViews: 0, avgPerDay: 0, maxDay: '0 views', daysTracked: 0 };
	}
};

const fetchArticleSummary = async (language, title) => {
	const encodedTitle = encodeURIComponent(title);
	const url = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;
	try {
		const response = await axios.get(url);
		return {
			extract: response.data.extract || '',
			description: response.data.description || '',
		};
	} catch {
		return { extract: '', description: '' };
	}
};

const spiralColorScale = d3.scaleLinear()
	.domain([0, 0.25, 0.5, 0.75, 1])
	.range(['#eae4f7', '#6cc5c5', '#2e8fb8', '#1a5a9e', '#0b1a48'])
	.clamp(true);

function getPolarColor(normalized, isSpike) {
	if (isSpike) return '#e8175d';
	return spiralColorScale(normalized);
}

function dayToDateLabel(year, dayOfYear) {
	const date = new Date(year, 0, dayOfYear);
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

const SpiralChart = React.forwardRef(function SpiralChart({ data }, ref) {
	const svgRef = useRef(null);

	React.useImperativeHandle(ref, () => ({
		downloadPNG: () => {
			if (!svgRef.current) return;
			const serializer = new XMLSerializer();
			let source = serializer.serializeToString(svgRef.current);
			if (!source.match(/^<svg/)) {
				source = '<svg ' + source.substring(source.indexOf('<svg ') + 5);
			}
			const svg64 = btoa(unescape(encodeURIComponent(source)));
			const image64 = 'data:image/svg+xml;base64,' + svg64;
			const img = new window.Image();
			const width = svgRef.current.width.baseVal.value || 600;
			const height = svgRef.current.height.baseVal.value || 600;
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
					a.download = 'wikipulse.png';
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
				}, 'image/png');
			};
			img.src = image64;
		},
	}));

	useEffect(() => {
		if (!data || !svgRef.current) return;

		const daysPerWeek = 7;

		const sorted = [...data].sort((a, b) => {
			if (a.year !== b.year) return a.year - b.year;
			return a.dayOfYear - b.dayOfYear;
		});
		if (sorted.length === 0) return;

		const toDate = (d) => {
			const dt = new Date(d.year, 0, 1);
			dt.setDate(d.dayOfYear);
			return dt;
		};

		const firstDate = toDate(sorted[0]);
		const lastDate = toDate(sorted[sorted.length - 1]);
		const totalMs = lastDate - firstDate;
		const totalTurns = totalMs / (365.25 * 24 * 60 * 60 * 1000);
        const minDayLayer = 5;
		const maxDayLayer = 11;
		const getDayLayer = (t) => minDayLayer + (maxDayLayer - minDayLayer) * (t * t * t * (t * (6 * t - 15) + 10));
		const getBandThickness = (t) => daysPerWeek * getDayLayer(t);

		const innerRadius = 10;
		const bandGap = 4;

		const weekColumns = [];
		for (let i = 0; i < sorted.length; i += daysPerWeek) {
			const chunk = sorted.slice(i, i + daysPerWeek);
			const midDate = toDate(chunk[Math.floor(chunk.length / 2)]);
			const t = (midDate - firstDate) / totalMs;
			weekColumns.push({ t, days: chunk });
		}

		const totalWeeks = weekColumns.length;
		const weekAngle = (Math.PI * 2) / (totalWeeks / totalTurns);
		const colRadii = [];
		let curRadius = innerRadius;
		for (let i = 0; i < weekColumns.length; i++) {
			const t = weekColumns[i].t;
			const bandH = getBandThickness(t);
			colRadii.push({ base: curRadius, top: curRadius + bandH });
			curRadius += (bandH + bandGap) * (weekAngle / (Math.PI * 2));
		}
		const maxRadius = colRadii[colRadii.length - 1].top;
        const labelPadding = 65;
		const chartRadius = maxRadius + labelPadding;
		const size = Math.ceil(chartRadius * 2);
		const width = size;
		const legendHeight = 90;
		const topCrop = 110;
		const height = size + legendHeight - topCrop;
		const angularGap = 0;

		// Global normalization
		const allValues = sorted.map(d => d.views).filter(v => v != null);
		const min = Math.min(...allValues);
		const max = Math.max(...allValues);
		const logMin = Math.log1p(min);
		const logMax = Math.log1p(max);
		const logRange = logMax - logMin || 1;
		const globalAvg = allValues.reduce((a, b) => a + b, 0) / allValues.length;

		// Clear & setup SVG
		d3.select(svgRef.current).selectAll('*').remove();

		const svg = d3
			.select(svgRef.current)
			.attr('width', width)
			.attr('height', height)
			.attr('viewBox', `0 ${topCrop} ${width} ${height}`)
			.style('max-width', '100%');

		const g = svg
			.append('g')
			.attr('transform', `translate(${width / 2}, ${size / 2})`);

		const firstMonth = firstDate.getMonth(); // 0-based
		const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

		for (let m = 0; m < 12; m++) {
			// Angle for this month: offset from the starting month
			const monthOffset = ((m - firstMonth + 12) % 12) / 12;
			const angle = monthOffset * Math.PI * 2 - Math.PI / 2;

			g.append('line')
				.attr('x1', (innerRadius - 10) * Math.cos(angle))
				.attr('y1', (innerRadius - 10) * Math.sin(angle))
				.attr('x2', (maxRadius + 10) * Math.cos(angle))
				.attr('y2', (maxRadius + 10) * Math.sin(angle))
				.attr('stroke', '#e0e0e0')
				.attr('stroke-width', 0.5);

			g.append('text')
				.attr('x', (maxRadius + 34) * Math.cos(angle))
				.attr('y', (maxRadius + 34) * Math.sin(angle))
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'middle')
				.attr('font-size', 16)
				.attr('font-weight', 600)
				.attr('fill', '#444')
				.text(monthNames[m]);
		}

		weekColumns.forEach((col, colIdx) => {
			const continuousAngle = col.t * totalTurns * Math.PI * 2 - Math.PI / 2;
			const { base, top } = colRadii[colIdx];

			const startAngle = continuousAngle + Math.PI / 2;
			const endAngle = startAngle + weekAngle - angularGap;

			col.days.forEach((dayItem, dayIdx) => {
				const v = dayItem.views;
				if (v == null) return;

				const normalized = (Math.log1p(v) - logMin) / logRange;
				const isSpike = v > globalAvg * 2.5;

				const ir = base + (dayIdx / daysPerWeek) * (top - base);
				const or = base + ((dayIdx + 1) / daysPerWeek) * (top - base);

				const arc = d3.arc()
					.innerRadius(ir)
					.outerRadius(or)
					.startAngle(startAngle)
					.endAngle(endAngle);

				g.append('path')
					.attr('d', arc)
					.attr('fill', getPolarColor(normalized, isSpike))
					.append('title')
					.text(`${dayToDateLabel(dayItem.year, dayItem.dayOfYear)} - ${Math.round(v).toLocaleString()} views`);
			});
		});

		const years = [...new Set(sorted.map(d => d.year))].sort();
		years.forEach((year) => {
			const jan1 = new Date(year, 0, 1);
			const t = Math.max(0, Math.min(1, (jan1 - firstDate) / totalMs));
			const angle = t * totalTurns * Math.PI * 2 - Math.PI / 2;
			const closestIdx = weekColumns.reduce((best, col, i) =>
				Math.abs(col.t - t) < Math.abs(weekColumns[best].t - t) ? i : best, 0);
			const { base, top } = colRadii[closestIdx];
			const r = (base + top) / 2;

			g.append('text')
				.attr('x', r * Math.cos(angle))
				.attr('y', r * Math.sin(angle))
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'middle')
				.attr('font-size', 13)
				.attr('font-weight', 500)
				.attr('fill', '#444')
				.text(year);
		});

		const swatchSize = 22;
		const swatchGap = 7;
		const legendX = 14;
		const legendY = size + 55;

		const legendItems = [
			{ color: '#e8175d', label: kFormatter(max) },
			{ color: spiralColorScale(0.5), label: kFormatter(Math.round((min + max) / 2)) },
			{ color: spiralColorScale(0), label: kFormatter(min) + ' views' },
		];

		legendItems.forEach((item, i) => {
			const y = legendY - (legendItems.length - 1 - i) * (swatchSize + swatchGap);
			svg.append('rect')
				.attr('x', legendX).attr('y', y)
				.attr('width', swatchSize).attr('height', swatchSize)
				.attr('fill', item.color);
			svg.append('text')
				.attr('x', legendX + swatchSize + 8)
				.attr('y', y + swatchSize - 3)
				.attr('font-size', 16)
				.attr('font-weight', 500)
				.attr('fill', item.color)
				.text(item.label);
		});

	}, [data]);

	return <svg ref={svgRef} />;
});


export default function WikiPulse() {
	const [{ language, title }] = useSearchState();
	const article = title || 'Chocolate';

	const { isLoading: yearlyLoading, data: yearlyData = [] } = useQuery(
		['wikipulseYearly', language, article],
		() => fetchYearlyData(language, article),
		{ staleTime: Infinity, enabled: !!(language && article) }
	);

	const { isLoading: weeklyLoading, data: weeklyData = [] } = useQuery(
		['wikipulseWeekly', language, article],
		() => fetchWeeklyData(language, article),
		{ staleTime: Infinity, enabled: !!(language && article) }
	);

	const { isLoading: monthlyLoading, data: monthlyData = [] } = useQuery(
		['wikipulseMonthly', language, article],
		() => fetchMonthlyTrend(language, article),
		{ staleTime: Infinity, enabled: !!(language && article) }
	);

	const { isLoading: statsLoading, data: statsData = {} } = useQuery(
		['wikipulseStats', language, article],
		() => fetchOverviewStats(language, article),
		{ staleTime: Infinity, enabled: !!(language && article) }
	);

	const { isLoading: summaryLoading, data: summaryData = {} } = useQuery(
		['wikipulseSummary', language, article],
		() => fetchArticleSummary(language, article),
		{ staleTime: Infinity, enabled: !!(language && article) }
	);

	const isLoading = yearlyLoading || weeklyLoading || monthlyLoading || statsLoading || summaryLoading;

	const spiralRef = React.useRef();
	const weeklyRef = React.useRef();

	if (isLoading) {
		return <Loader />;
	}

	const groupedByYear = {};
	monthlyData.forEach(d => {
		const year = d.date.split('-')[0];
		if (!groupedByYear[year]) groupedByYear[year] = [];
		groupedByYear[year].push(d);
	});
	const spacedMonthly = [];
	const years = Object.keys(groupedByYear).sort();
	years.forEach((year, i) => {
		spacedMonthly.push(...groupedByYear[year]);
		if (i < years.length - 1) {
			spacedMonthly.push({ date: `${year}-13`, views: null });
		}
	});

	const monthlyChartData = [
		{
			type: 'bar',
			x: spacedMonthly.map((d, i) => i),
			y: spacedMonthly.map(d => d.views),
			marker: {
				color: spacedMonthly.map(d => d.views == null ? 'rgba(0,0,0,0)' : '#a6cee3'),
			},
			hovertemplate: spacedMonthly.map(d => {
				if (d.views == null) return '<extra></extra>';
				const [y, m] = d.date.split('-');
				const monthName = new Date(y, parseInt(m) - 1).toLocaleString('en-US', { month: 'long' });
				return `<b>${monthName}, ${kFormatter(d.views)} views</b><extra></extra>`;
			}),
			hoverinfo: 'text',
		},
	];

	const tickvals = [];
	const ticktext = [];
	let idx = 0;
	years.forEach((year, i) => {
		const count = groupedByYear[year].length;
		tickvals.push(idx + Math.floor(count / 2));
		ticktext.push(year);
		idx += count + (i < years.length - 1 ? 1 : 0);
	});

	const monthlyLayout = {
		xaxis: {
			tickvals,
			ticktext,
			tickfont: { size: 12 },
			showgrid: false,
		},
		yaxis: {
			showticklabels: false,
			showgrid: false,
			zeroline: false,
		},
		margin: { l: 10, r: 10, t: 10, b: 30 },
		paper_bgcolor: 'rgba(0,0,0,0)',
		plot_bgcolor: '#fff',
		showlegend: false,
		height: 140,
		bargap: 0.15,
	};

	const readableTitle = denormalize(article);

	const handleDownload = () => {
		spiralRef.current?.downloadPNG();
	};

	const handleWeeklyDownload = () => {
		const el = weeklyRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const w = Math.ceil(rect.width);
		const h = Math.ceil(rect.height);
		const xmlns = 'http://www.w3.org/1999/xhtml';
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="${xmlns}">${el.outerHTML}</div></foreignObject></svg>`;
		const svg64 = btoa(unescape(encodeURIComponent(svg)));
		const img = new window.Image();
		img.onload = function () {
			const canvas = document.createElement('canvas');
			canvas.width = w * 2;
			canvas.height = h * 2;
			const ctx = canvas.getContext('2d');
			ctx.scale(2, 2);
			ctx.fillStyle = '#fff';
			ctx.fillRect(0, 0, w, h);
			ctx.drawImage(img, 0, 0, w, h);
			canvas.toBlob(function (blob) {
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = 'weekly_pulse.png';
				a.click();
				URL.revokeObjectURL(url);
			}, 'image/png');
		};
		img.src = 'data:image/svg+xml;base64,' + svg64;
	};

	return (
		<div className="wikipulse-wrapper">
			<div className="wikipulse-grid">
				{/* LEFT PANEL */}
				<div className="wikipulse-left">
					{/* HEADER */}
					<div className="wikipulse-header">
						<h1 className="wikipulse-title">{readableTitle}</h1>
						<p className="wikipulse-subtitle">{(statsData.totalViews || 0).toLocaleString()} views last month</p>
						{summaryData.extract && (
							<p className="wikipulse-description">{summaryData.extract}</p>
						)}
						<a href={`https://${language}.wikipedia.org/wiki/${encodeURIComponent(article)}`} target="_blank" rel="noopener noreferrer" className="wikipulse-link">
							VIEW ON WIKIPEDIA &raquo;
						</a>
					</div>
					<div className="wikipulse-chart-section">
						<h3 className="wikipulse-section-title">Monthly trend</h3>
						<Plot
							data={monthlyChartData}
							layout={monthlyLayout}
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
							style={{ width: '100%' }}
						/>
					</div>

					{/* WEEKLY PULSE */}
					<div className="wikipulse-chart-section chart-download-wrapper">
						<CameraDownloadButton onClick={handleWeeklyDownload} />
						<h3 className="wikipulse-section-title">Weekly pulse</h3>
						<div className="wikipulse-weekly-labels" ref={weeklyRef}>
							{weeklyData.length > 0 && (() => {
								const overallAvg = weeklyData.reduce((s, d) => s + d.avgViews, 0) / weeklyData.length;
								return weeklyData.map(d => (
									<div key={d.dayNum} className="wikipulse-weekly-label">
										<div className="wikipulse-label-day">{d.day}</div>
										<div className="wikipulse-label-value">
											{overallAvg > 0 ? (d.avgViews / overallAvg).toFixed(2) + 'x' : '—'}
										</div>
									</div>
								));
							})()}
						</div>
					</div>
				</div>

				<div className="wikipulse-right">
					<h3 className="wikipulse-right-title">Yearly seasonality</h3>
					<div className="chart-download-wrapper">
						<CameraDownloadButton onClick={handleDownload} />
						<SpiralChart ref={spiralRef} data={yearlyData} />
					</div>
				</div>
			</div>
		</div>
	);
}
