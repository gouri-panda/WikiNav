import React, { useState } from 'react';
import html2pdf from 'html2pdf.js';
import { useSearchState } from '../searchStateContext';

export default function PdfDownloadButton() {
  const [loading, setLoading] = useState(false);
  const [searchState] = useSearchState();

  const handleDownload = () => {
    const element = document.querySelector('.main-container');
    if (!element) return;

    setLoading(true);

    const title = searchState.title || 'Untitled';
    const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_');

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${safeName}_ArticleOverview.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .finally(() => setLoading(false));
  };

  return (
    <button
      type="button"
      className="pdf-download-button"
      onClick={handleDownload}
      disabled={loading}
      title="Download page as PDF"
      aria-label="Download page as PDF"
    >
      {loading ? (
        'Generating PDF…'
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ marginRight: 6, verticalAlign: 'middle' }}
          >
            <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3.5H19V9h1.5v1H19v2h-1.5V7h3v1zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
          </svg>
          Download PDF
        </>
      )}
    </button>
  );
}
