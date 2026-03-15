/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
// eslint-disable-next-line import/no-extraneous-dependencies
import * as d3 from "d3";
import MultiSelect from "./LanguageComparison/MultiSelect";
import { useSearchState } from "../searchStateContext";
import Loader from "./Loader";

const width = 1000;
const height = 500;
const fixedLangOption = { value: "enwiki", label: "enwiki", isFixed: true };

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

    function fontScale(r, min, max, factor) {
        return Math.max(min, Math.min(max, r * factor));
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
                } catch {}
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
    async function fetchLanguage(lang) {
        try {
            const code = lang.replace("wiki", "");
            const localizedTitle = titlesByWiki[lang] || article;
            const encodedTitle = encodeURIComponent(localizedTitle);
            const fetchRevisionsPage = async (rvcontinue) => {
                const params = new URLSearchParams({
                    action: "query",
                    prop: "revisions",
                    titles: encodedTitle,
                    rvprop: "size|tags",
                    rvlimit: "max",
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

            if (revs.length === 0) {
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
            const totalSize = revs.reduce((sum, rev) => sum + (rev.size || 0), 0);
            const revertSize = revertedRevisions.reduce((sum, rev) => sum + (rev.size || 0), 0);

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
        setLoading(true);
        setProgress(0);
        setMissing([]);
        try {
            let completed = 0;

            const languageResults = await Promise.all(
                selected.map(async (lang) => {
                    const stats = await fetchLanguage(lang);
                    completed += 1;
                    setProgress(completed);
                    return { lang, stats };
                })
            );

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
            setLoading(false);
        }

    }
    useEffect(() => {
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
    }, [selected, article, titlesByWiki, isLookupReady]);

    useEffect(() => {

        if (data.length === 0) {
            return () => {};
        }

        const svg = d3.select(svgRef.current);

        svg.selectAll("*").remove();

        const centerX = width / 2;
        const centerY = height / 2;

        const maxSize = d3.max(data, d => d.size);

        const rScale = d3.scaleSqrt()
            .domain([0, maxSize])
            .range([35, 110]);

        [80, 120, 160, 200, 240].forEach(r => {

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

        const node = svg.selectAll("g")
            .data(nodes)
            .enter()
            .append("g");

        node.append("circle")
            .attr("r", d => d.r + 6)
            .attr("fill", "#c8d87a");

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
                .text(d => (d.revertSize ?? 0).toLocaleString())
                .attr("x", -15)
                .attr("y", d => d.r + 35)
                .style("font-size", "12px")
                .style("fill", "#2e7d32");
        }

        const simulation = d3.forceSimulation(nodes)
            .force("center", d3.forceCenter(centerX, centerY))
            .force("collision", d3.forceCollide().radius(d => d.r + 10))
            .force("radial", d3.forceRadial(200, centerX, centerY).strength(.8))
            .on("tick", ticked);
        return () => simulation.stop();

    }, [data]);

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

    const langOptions = languages
        .filter(l => l !== fixedLangOption.value)
        .map(l => ({ value: l, label: l, isFixed: false }));

    return (

        <div>
            <div className="language-select">
                <MultiSelect
                    fixed={fixedLangOption}
                    options={langOptions}
                    handleSelection={addLang}
                    handleRemoval={(removed) =>
                        setSelected((prev) =>
                            prev.filter((l) => !removed.find((r) => r.value === l))
                        )
                    }
                />
            </div>
            <div className="sankey-controls-right" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
                <button
                    type="button"
                    onClick={download}
                    className="sankey-download-button"
                >
                    Download SVG
                </button>
            </div>
            {loading && data.length === 0 && <Loader />}

            {loading && data.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                    Updating graph in background: {progress} / {selected.length} languages
                    <progress value={progress} max={selected.length} />
                </div>
            )}
            {missing.length > 0 &&

                <div style={{ color: "red", marginBottom: 6 }}>
                    Missing: {missing.join(", ")}
                </div>

            }
            <svg
                ref={svgRef}
                width={width}
                height={height}
            />
        </div>
    );
}