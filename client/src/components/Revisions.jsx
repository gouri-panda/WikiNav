/* eslint-disable */
import React, { useEffect, useMemo, useRef, useState } from "react";
// eslint-disable-next-line import/no-extraneous-dependencies
import * as d3 from "d3";
import MultiSelect from "./LanguageComparison/MultiSelect";
import { useSearchState } from "../searchStateContext";
import Loader from "./Loader";

const width = 1000;
const baseHeight = 700;
const extraHeightPerNode = 65;
const fixedLangOption = { value: "enwiki", label: "enwiki", isFixed: true };

function formatWikiDomain(wikiKey) {
    return `${wikiKey.replace("wiki", "")}.wikipedia.org`;
}

function buildLanguageLabel(wikiKey, localizedTitle, isCurrent = false) {
    const readableTitle = localizedTitle ? localizedTitle.replaceAll("_", " ") : "";
    const titleSuffix = readableTitle ? ` - ${readableTitle}` : "";
    const currentSuffix = isCurrent ? " (current)" : "";
    return `${formatWikiDomain(wikiKey)}${titleSuffix}${currentSuffix}`;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function fetchJsonWithRetry(url, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const res = await fetch(url);
            const text = await res.text();

            if (
                text.includes("You are making too many requests")
                || text.includes("Please reduce your request rate")
            ) {
                throw new Error("rate-limited");
            }

            return JSON.parse(text);
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            await sleep(300 * (attempt + 1));
        }
    }

    return null;
}

export default function WikiLanguageViz() {

    const svgRef = useRef();
    const loadRequestRef = useRef(0);
    const [{ title, language }] = useSearchState();
    const article = title || "Chocolate";

    const [languages, setLanguages] = useState([]);
    const [selected, setSelected] = useState(["enwiki"]);
    const [titlesByWiki, setTitlesByWiki] = useState({});
    const [data, setData] = useState([]);
    const [missing, setMissing] = useState([]);
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isLookupReady, setIsLookupReady] = useState(false);
    const [periodPreset, setPeriodPreset] = useState("365");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [periodError, setPeriodError] = useState("");

    const chartHeight = useMemo(() => {
        const nodeCount = Math.max(data.length, 1);
        const extraNodes = Math.max(0, nodeCount - 6);
        return baseHeight + (extraNodes * extraHeightPerNode);
    }, [data.length]);

    function fontScale(r, min, max, factor) {
        return Math.max(min, Math.min(max, r * factor));
    }

    function getPeriodWindow() {
        const now = new Date();

        if (periodPreset === "custom") {
            if (!customStart || !customEnd) {
                return { window: null, error: "Select both custom start and end dates." };
            }

            const startDate = new Date(`${customStart}T00:00:00`);
            const endDate = new Date(`${customEnd}T23:59:59`);

            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                return { window: null, error: "Invalid custom date range." };
            }

            if (startDate > endDate) {
                return { window: null, error: "Custom start date must be before end date." };
            }

            return {
                window: {
                    startISO: startDate.toISOString(),
                    endISO: endDate.toISOString()
                },
                error: ""
            };
        }

        const days = Number(periodPreset);
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - days);

        return {
            window: {
                startISO: startDate.toISOString(),
                endISO: now.toISOString()
            },
            error: ""
        };
    }
    async function getQID() {
        if (!article) return null;
        try {
            const encodedTitle = encodeURIComponent(article);
            const candidateLanguages = [...new Set([language, "en"])].filter(Boolean);
            for (let i = 0; i < candidateLanguages.length; i += 1) {
                const candidate = candidateLanguages[i];
                const json = await fetchJsonWithRetry(
                    `https://${candidate}.wikipedia.org/w/api.php?action=query&titles=${encodedTitle}&prop=pageprops&format=json&origin=*`
                );
                const page = Object.values(json.query?.pages || {})[0] || {};
                if (page.pageprops?.wikibase_item) {
                    return page.pageprops.wikibase_item;
                }
            }
            return null;
        } catch {
            return null;
        }
    }
    async function loadLanguages() {

        setIsLookupReady(false);

        try {
            const qid = await getQID();

            if (!qid) {
                setLanguages([fixedLangOption.value]);
                setTitlesByWiki({ [fixedLangOption.value]: article });
                setIsLookupReady(true);
                return;
            }

            const json = await fetchJsonWithRetry(
                `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`
            );

            const sitelinkEntries = Object.entries(json.entities?.[qid]?.sitelinks || {});
            const sitelinks = sitelinkEntries.map(([wiki]) => wiki);
            const mappedTitles = sitelinkEntries.reduce((acc, [wiki, info]) => {
                if (info?.title) {
                    acc[wiki] = info.title;
                }
                return acc;
            }, {});
            if (!mappedTitles[fixedLangOption.value] && article && language && language !== "en") {
                try {
                    const encodedTitle = encodeURIComponent(article);
                    const langJson = await fetchJsonWithRetry(
                        `https://${language}.wikipedia.org/w/api.php?action=query&titles=${encodedTitle}&prop=langlinks&lllang=en&lllimit=1&format=json&origin=*`
                    );
                    const page = Object.values(langJson.query?.pages || {})[0] || {};
                    const englishTitle = page.langlinks?.[0]?.["*"];
                    if (englishTitle) {
                        mappedTitles[fixedLangOption.value] = englishTitle;
                    }
                } catch {
                }
            }

            if (!mappedTitles[fixedLangOption.value]) {
                mappedTitles[fixedLangOption.value] = article;
            }
            const uniqueSitelinks = Array.from(new Set([fixedLangOption.value, ...sitelinks]));

            setLanguages(uniqueSitelinks);
            setTitlesByWiki(mappedTitles);
            setIsLookupReady(true);
        } catch {
            setLanguages([fixedLangOption.value]);
            setTitlesByWiki({ [fixedLangOption.value]: article });
            setIsLookupReady(true);
        }

    }
    async function fetchLanguage(lang, periodWindow) {

        try {

            const code = lang.replace("wiki", "");
            const localizedTitle = titlesByWiki[lang] || article;
            const encodedTitle = encodeURIComponent(localizedTitle);
            const { startISO, endISO } = periodWindow;

            const fetchBoundarySize = async (boundaryISO) => {
                const params = new URLSearchParams({
                    action: "query",
                    prop: "revisions",
                    titles: encodedTitle,
                    rvprop: "size",
                    rvlimit: "1",
                    rvstart: boundaryISO,
                    rvdir: "older",
                    format: "json",
                    origin: "*"
                });

                const json = await fetchJsonWithRetry(`https://${code}.wikipedia.org/w/api.php?${params.toString()}`);
                const page = Object.values(json.query?.pages || {})[0] || {};
                const revision = page.revisions?.[0];

                if (typeof revision?.size === "number") {
                    return revision.size;
                }

                return null;
            };

            const fetchRevisionsPage = async (rvcontinue) => {
                const params = new URLSearchParams({
                    action: "query",
                    prop: "revisions",
                    titles: encodedTitle,
                    rvprop: "size|tags|timestamp",
                    rvlimit: "max",
                    rvstart: endISO,
                    rvend: startISO,
                    rvdir: "older",
                    format: "json",
                    origin: "*"
                });
                if (rvcontinue) {
                    params.set("rvcontinue", rvcontinue);
                }
                return fetchJsonWithRetry(`https://${code}.wikipedia.org/w/api.php?${params.toString()}`);
            };

            const fetchAllRevisions = async (rvcontinue = undefined, acc = [], batchCount = 0) => {
                const json = await fetchRevisionsPage(rvcontinue);
                const page = Object.values(json.query?.pages || {})[0] || {};
                const batch = page.revisions || [];
                const merged = acc.concat(batch);

                if (batchCount >= 20) {
                    return merged;
                }
                if (!json.continue?.rvcontinue) {
                    return merged;
                }
                await sleep(120);
                return fetchAllRevisions(json.continue.rvcontinue, merged, batchCount + 1);
            };

            const revs = await fetchAllRevisions();

            const [sizeAtEnd, sizeAtStart] = await Promise.all([
                fetchBoundarySize(endISO),
                fetchBoundarySize(startISO)
            ]);

            if (revs.length === 0 && sizeAtEnd === null && sizeAtStart === null) {

                setMissing(m => [...m, lang]);
                return null;
            }

            const revisions = revs.length;

            const revertedRevisions = revs.filter(r =>
                r.tags?.includes("mw-reverted") ||
                r.tags?.includes("mw-rollback") ||
                r.tags?.includes("mw-undo")
            );
            const reverts = revertedRevisions.length;

            // Page size at end of selected time period.
            const totalSize = sizeAtEnd ?? revs[0]?.size ?? 0;
            // Net page size change over selected time period.
            const startSize = sizeAtStart ?? totalSize;
            const revertSize = totalSize - startSize;

            return {
                lang,
                revisions,
                reverts,
                size: totalSize,
                revertSize
            };

        } catch {
            setMissing(m => [...m, lang]);
            return null;
        }
    }
    async function loadData() {
        const { window: periodWindow, error } = getPeriodWindow();
        setPeriodError(error);
        if (!periodWindow) {
            setData([]);
            setProgress(0);
            setMissing([]);
            return;
        }
        const requestId = ++loadRequestRef.current;
        setLoading(true);
        setProgress(0);
        setMissing([]);
        try {
            let completed = 0;

            const languageResults = await Promise.all(
                selected.map(async (lang) => {
                    const stats = await fetchLanguage(lang, periodWindow);
                    completed += 1;
                    if (requestId === loadRequestRef.current) {
                        setProgress(completed);
                    }
                    return { lang, stats };
                })
            );
            if (requestId !== loadRequestRef.current) {
                return;
            }

            const hasLanguageFailure = languageResults.some(({ stats }) => !stats);
            const results = languageResults
                .map(({ stats }) => stats)
                .filter(Boolean);

            setData((prev) => {
                // Keep current graph visible when adding/removing languages causes partial failures.
                if (hasLanguageFailure && prev.length > 0) {
                    return prev;
                }
                return results;
            });
        } finally {
            if (requestId === loadRequestRef.current) {
                setLoading(false);
            }
        }

    }
    useEffect(() => {
        loadRequestRef.current += 1;
        setSelected([fixedLangOption.value]);
        setLanguages([fixedLangOption.value]);
        setTitlesByWiki({});
        setData([]);
        setMissing([]);
        loadLanguages();
    }, [article, language]);
    useEffect(() => {
        if (!isLookupReady) {
            return;
        }

        const hasTitlesForSelection = selected.every(
            (lang) => titlesByWiki[lang] || (lang === fixedLangOption.value && article)
        );

        if (!hasTitlesForSelection) {
            return;
        }

        loadData();
    }, [selected, article, titlesByWiki, isLookupReady, periodPreset, customStart, customEnd]);

    useEffect(() => {
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        if (data.length === 0) {
            return () => {};
        }

        const centerX = width / 2;
        const centerY = chartHeight / 2;
        const maxOrbitRadius = Math.max(
            180,
            Math.min((width / 2) - 130, (chartHeight / 2) - 90)
        );

        const maxSize = d3.max(data, d => d.size);

        const rScale = d3.scaleSqrt()
            .domain([0, maxSize])
            .range([35, 110]);

        const ringCount = 5;
        const ringStep = maxOrbitRadius / ringCount;

        Array.from({ length: ringCount }, (_, i) => ringStep * (i + 1)).forEach(r => {

            svg.append("circle")
                .attr("cx", centerX)
                .attr("cy", centerY)
                .attr("r", r)
                .attr("fill", "none")
                .attr("stroke", "#e6e6e6");

        });

        svg.append("defs")
            .append("marker")
            .attr("id", "arrow")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 8)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#666");


        const nodes = data.map(d => ({
            ...d,
            r: rScale(d.size)
        }));
        const getDeltaRingFill = (value) => {
            if (value < 0) return "#c62828";
            if (value === 0) return "#6b7280";
            return "#c8d87a";
        };


        const node = svg.selectAll("g")
            .data(nodes)
            .enter()
            .append("g");

        node.append("circle")
            .attr("r", d => d.r + 6)
            .attr("fill", d => getDeltaRingFill(d.revertSize ?? 0));

        node.append("circle")
            .attr("r", d => d.r)
            .attr("fill", "#6e8595");

        node.append("text")
            .text(d => d.revisions)
            .attr("text-anchor", "middle")
            .attr("dy", d => {
                if (d.r < 50) return -6   // small bubble layout
                return -d.r * 0.15       // large bubble layout
            })
            .style("fill", "white")
            .style("font-weight", "bold")
            .style("font-size", d => fontScale(d.r, 16, 46, .45));

        node.append("text")
            .text(d => d.lang)
            .attr("text-anchor", "middle")
            .attr("dy", d => {
                if (d.r < 50) return 10
                return d.r * 0.15

            })
            .style("fill", "white")
            .style("font-size", d => fontScale(d.r, 16, 22, .22));

        node.append("text")
            .text(d => d.reverts)
            .attr("text-anchor", "middle")
            .attr("dy", d => {
                if (d.r < 50) return 24
                return d.r * 0.40
            })
            .style("fill", "white")
            .style("font-size", d => fontScale(d.r, 14, 20, .20));


        /* SIZE LINE */

        node.append("line")
            .attr("class", "sizeLine")
            .attr("stroke", "#888")
            .attr("marker-end", "url(#arrow)");


        node.append("text")
            .attr("class", "size");
        node.append("line")
            .attr("class", "deltaLine")
            .attr("stroke", "#888")
            .attr("marker-end", "url(#arrow)");

        node.append("text")
            .attr("class", "delta");

        function ticked() {

            node.attr("transform", d => `translate(${d.x},${d.y})`);

            node.select(".sizeLine")
                .attr("x1", d => d.r)
                .attr("y1", 0)
                .attr("x2", d => d.r + 35)
                .attr("y2", -5);
            node.select(".size")
                .text(d => d.size.toLocaleString())
                .attr("x", d => d.r + 40)
                .attr("y", -6)
                .style("font-size", "12px");

            node.select(".deltaLine")
                .attr("x1", 0)
                .attr("y1", d => d.r)
                .attr("x2", -10)
                .attr("y2", d => d.r + 25);
            node.select(".delta")
                .text(d => {
                    const v = d.revertSize ?? 0;
                    return (v >= 0 ? "+" : "") + v.toLocaleString();
                })
                .attr("x", -15)
                .attr("y", d => d.r + 35)
                .style("font-size", "12px")
                .style("fill", d => {
                    const v = d.revertSize ?? 0;
                    if (v < 0) return "#c62828";
                    if (v === 0) return "#6b7280";
                    return "#2e7d32";
                });

        }

        const simulation = d3.forceSimulation(nodes)
            .force("center", d3.forceCenter(centerX, centerY))
            .force("collision", d3.forceCollide().radius(d => d.r + 10))
            .force("radial", d3.forceRadial(maxOrbitRadius * 0.82, centerX, centerY).strength(.8))
            .on("tick", ticked);

        return () => simulation.stop();

    }, [data, chartHeight]);
    function addLang(lang) {
        setSelected((prev) => {
            if (prev.includes(lang)) return prev;
            return [...prev, lang];
        });
    }

    function download() {

        const svg = svgRef.current;

        const serializer = new XMLSerializer();

        const src = serializer.serializeToString(svg);

        const blob = new Blob([src], { type: "image/svg+xml" });

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;
        a.download = "wikilangviz.svg";

        a.click();

    }
    const currentArticleLabel = titlesByWiki[fixedLangOption.value] || article;
    const fixedOption = useMemo(() => ({
        ...fixedLangOption,
        label: buildLanguageLabel(fixedLangOption.value, currentArticleLabel, true)
    }), [currentArticleLabel]);

    const langOptions = useMemo(() => (
        languages
            .filter(l => l !== fixedLangOption.value)
            .map(l => ({
                value: l,
                label: buildLanguageLabel(l, titlesByWiki[l] || article),
                isFixed: false
            }))
    ), [languages, titlesByWiki, article]);

    const selectedPeriodLabel = periodPreset === "custom"
        ? (customStart && customEnd ? `${customStart} to ${customEnd}` : "a custom range")
        : `the last ${periodPreset} days`;

    return (

        <div className="revisions-container">
            <div className="revisions-toolbar">
                <div className="revisions-period-panel">
                    <div className="revisions-control-group">
                        <label className="revisions-period-label" htmlFor="revisions-language-select">
                            Article languages
                        </label>
                        <div id="revisions-language-select" className="revisions-language-select">
                            <MultiSelect
                                fixed={fixedOption}
                                options={langOptions}
                                handleSelection={addLang}
                                handleRemoval={(removed) =>
                                    setSelected((prev) =>
                                        prev.filter((l) => !removed.find((r) => r.value === l))
                                    )
                                }
                            />
                        </div>
                    </div>

                    <div className="revisions-control-group revisions-time-group">
                        <label htmlFor="revisions-period-select" className="revisions-period-label">Time period</label>
                        <select
                            id="revisions-period-select"
                            className="revisions-period-select"
                            value={periodPreset}
                            onChange={(e) => setPeriodPreset(e.target.value)}
                        >
                            <option value="30">Last 30 days</option>
                            <option value="90">Last 90 days</option>
                            <option value="365">Last 365 days</option>
                            <option value="custom">Custom range</option>
                        </select>

                        {periodPreset === "custom" && (
                            <div className="revisions-custom-range">
                                <input
                                    type="date"
                                    className="revisions-date-input"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    aria-label="Custom start date"
                                />
                                <span>to</span>
                                <input
                                    type="date"
                                    className="revisions-date-input"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    aria-label="Custom end date"
                                />
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={download}
                        className="sankey-download-button"
                    >
                        Download SVG
                    </button>
                </div>
            </div>

            <p className="paragraph">
                Showing revision activity for <strong>{article.replaceAll("_", " ")}</strong> across{' '}
                <strong>{selected.length}</strong> language editions during <strong>{selectedPeriodLabel}</strong>.
            </p>

            {periodError && (
                <div className="revisions-status revisions-status-error">
                    {periodError}
                </div>
            )}
            {loading && data.length === 0 && <Loader />}

            {loading && data.length > 0 && (
                <div className="revisions-status revisions-status-info">
                    Updating graph in background: {progress} / {selected.length} languages
                    <progress className="revisions-progress" value={progress} max={selected.length} />
                </div>
            )}
            {missing.length > 0 &&

                <div className="revisions-status revisions-status-warning">
                    Missing: {missing.map(formatWikiDomain).join(", ")}
                </div>

            }
            <div className="revisions-chart">
                <svg
                    ref={svgRef}
                    className="revisions-svg"
                    width={width}
                    height={chartHeight}
                    viewBox={`0 0 ${width} ${chartHeight}`}
                    preserveAspectRatio="xMidYMid meet"
                />
            </div>

        </div>
    );

}