// src/components/common/preview/FilePreviewModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const extOf = (name = "") => (name.split(".").pop() || "").toLowerCase();
const normalizeCT = (ct = "") => ct.toLowerCase();

function detectKind(fileName, contentType) {
  const ext = extOf(fileName || "");
  const ct = normalizeCT(contentType || "");
  if (ct.includes("pdf") || ext === "pdf") return "pdf";
  if (ct.startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg"].includes(ext)) return "image";
  if (ct.startsWith("text/") || ct === "application/json" || ["txt","csv","json","md","log"].includes(ext)) return "text";
  if (["doc","docx"].includes(ext) || ct.includes("officedocument.wordprocessingml")) return "doc";
  if (["xls","xlsx"].includes(ext) || ct.includes("officedocument.spreadsheetml")) return "xls";
  if (["ppt","pptx"].includes(ext) || ct.includes("officedocument.presentationml")) return "ppt";
  return "unknown";
}
const isOffice = (k) => k === "doc" || k === "xls" || k === "ppt";

export default function FilePreviewModal({
  url,                         // ← URL /preview (PDF direct) que tu utilises déjà
  token,
  fileName = "document",
  contentType = "",
  onClose,
  previewEndpoint = "http://localhost:8080/api/preview", // POST pour convertir → PDF
}) {
  const [blobUrl, setBlobUrl]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");
  const [textContent, setTextContent] = useState("");

  const [pdfDoc, setPdfDoc]     = useState(null);
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(0);
  const [scale, setScale]       = useState(1);
  const [forcedKind, setForcedKind] = useState("");

  const canvasRef     = useRef(null);
  const viewportRef   = useRef(null);
  const bodyRef       = useRef(null);
  const renderTaskRef = useRef(null);

  const detected = useMemo(() => detectKind(fileName, contentType), [fileName, contentType]);
  const kind     = forcedKind || detected;

  // construit l'URL /download à partir de l'URL /preview
  const downloadUrl = useMemo(() => {
    if (!url) return "";
    if (url.includes("/documents/") && url.endsWith("/preview")) {
      return url.replace(/\/preview$/, "/download");
    }
    return url; // fallback
  }, [url]);

  useEffect(() => {
    let aborted = false;
    let localUrl = null;

    (async () => {
      try {
        setLoading(true);
        setErr("");
        setPdfDoc(null);
        setForcedKind("");
        setPage(1);
        setPages(0);

        // --- Office : on prend l'original via /download, puis POST /api/preview ---
        if (isOffice(detected)) {
          // 1) GET original
          const res = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error(`GET original: ${res.status}`);
          const origBlob = await res.blob();
          if (aborted) return;

          // 2) POST vers /api/preview (conversion → PDF)
          const form = new FormData();
          const uploadFile = new File([origBlob], fileName || "document", {
            type: contentType || "application/octet-stream",
          });
          form.append("file", uploadFile);

          const conv = await fetch(previewEndpoint, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          if (!conv.ok) throw new Error(`POST /preview: ${conv.status}`);
          const pdfBlob = await conv.blob();
          if (aborted) return;

          localUrl = URL.createObjectURL(pdfBlob);
          setBlobUrl(localUrl);
          setForcedKind("pdf");

          const doc = await pdfjsLib.getDocument({ url: localUrl, rangeChunkSize: 65536 }).promise;
          if (aborted) return;
          setPdfDoc(doc);
          setPages(doc.numPages);
          setPage(1);
          return;
        }

        // --- PDF natif : GET /preview (stream PDF) ---
        if (detected === "pdf") {
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) throw new Error(`GET preview pdf: ${res.status}`);
          const blob = await res.blob();
          if (aborted) return;

          localUrl = URL.createObjectURL(blob);
          setBlobUrl(localUrl);

          const doc = await pdfjsLib.getDocument({ url: localUrl, rangeChunkSize: 65536 }).promise;
          if (aborted) return;
          setPdfDoc(doc);
          setPages(doc.numPages);
          setPage(1);
          return;
        }

        // --- Image / Texte : GET /download ---
        const res = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`GET download: ${res.status}`);
        const blob = await res.blob();
        if (aborted) return;

        localUrl = URL.createObjectURL(blob);
        setBlobUrl(localUrl);

        if (detected === "text") {
          try {
            const txt = await blob.text();
            if (!aborted) setTextContent(txt);
          } catch {
            if (!aborted) setTextContent("(impossible de lire le contenu texte)");
          }
        }
      } catch (e) {
        console.error("preview error:", e);
        if (!aborted) setErr(String(e.message || "Impossible de charger le fichier."));
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [url, token, previewEndpoint, detected, downloadUrl, fileName, contentType]);

  useEffect(() => {
    function fit() {
      if (!viewportRef.current || !bodyRef.current) return;
      const s = Math.max(0.5, Math.min(3, (bodyRef.current.clientWidth || viewportRef.current.width) / viewportRef.current.width));
      setScale(s);
    }
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pdfDoc || !canvasRef.current || kind !== "pdf") return;

      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
        renderTaskRef.current = null;
      }

      const p = await pdfDoc.getPage(page);
      const vp1 = p.getViewport({ scale: 1 });
      viewportRef.current = vp1;

      if (bodyRef.current && !canvasRef.current.dataset.renderedOnce) {
        const containerW = bodyRef.current.clientWidth || vp1.width;
        const auto = Math.max(0.5, Math.min(3, containerW / vp1.width));
        if (scale !== auto) { setScale(auto); return; }
      }

      const viewport = p.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const task = p.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try { await task.promise; if (cancelled) return; canvas.dataset.renderedOnce = "1"; }
      finally { if (renderTaskRef.current === task) renderTaskRef.current = null; }
    })();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, page, scale, kind]);

  const download = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    const dlName = (forcedKind === "pdf" && !fileName.toLowerCase().endsWith(".pdf"))
      ? fileName.replace(/\.[^.]+$/, "") + ".pdf"
      : fileName;
    a.href = blobUrl;
    a.download = dlName || "document.pdf";
    a.click();
  };
  const openNewTab = () => { if (blobUrl) window.open(blobUrl, "_blank", "noopener"); };

  const canPrev = page > 1;
  const canNext = page < pages;
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.1).toFixed(2)));
  const zoomIn  = () => setScale((s) => Math.min(3.0, +(s + 0.1).toFixed(2)));
  const fitWidth = () => {
    if (!viewportRef.current || !bodyRef.current) return;
    const s = Math.max(0.5, Math.min(3, bodyRef.current.clientWidth / viewportRef.current.width));
    setScale(s);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-3">
      <div className="bg-white dark:bg-gray-900 text-black dark:text-white w-full max-w-5xl max-h-[92vh] rounded-xl shadow-xl overflow-hidden flex flex-col">
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur flex items-center justify-between p-3 border-b border-black/10 dark:border-white/10">
          <div className="font-medium truncate pr-3">{fileName}</div>
          <div className="flex items-center gap-2">
            {kind === "pdf" && (
              <>
                <button onClick={zoomOut} className="px-2 py-1 border rounded">−</button>
                <div className="text-sm w-16 text-center">{Math.round(scale * 100)}%</div>
                <button onClick={zoomIn} className="px-2 py-1 border rounded">+</button>
                <button onClick={fitWidth} className="ml-1 px-2 py-1 border rounded">Ajuster largeur</button>
                <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-1" />
                <button disabled={!canPrev} onClick={() => { if (canvasRef.current) canvasRef.current.dataset.renderedOnce = ""; setPage((p) => p - 1); }} className="px-2 py-1 border rounded disabled:opacity-50">←</button>
                <div className="text-sm w-20 text-center">{pages ? `${page} / ${pages}` : "—"}</div>
                <button disabled={!canNext} onClick={() => { if (canvasRef.current) canvasRef.current.dataset.renderedOnce = ""; setPage((p) => p + 1); }} className="px-2 py-1 border rounded disabled:opacity-50">→</button>
                <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-1" />
              </>
            )}
            <button onClick={download} disabled={!blobUrl} className="px-3 py-1 border rounded disabled:opacity-50">Télécharger</button>
            <button onClick={openNewTab} disabled={!blobUrl} className="px-3 py-1 border rounded disabled:opacity-50">Ouvrir onglet</button>
            <button onClick={onClose} className="ml-1 px-3 py-1 bg-red-600 text-white rounded">Fermer</button>
          </div>
        </div>

        <div ref={bodyRef} className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-800 px-3 py-4">
          {loading && <div className="text-sm opacity-70">Chargement…</div>}
          {err && <div className="text-sm text-red-500">{err}</div>}

          {!loading && !err && kind === "pdf" && (
            <div className="w-full flex items-start justify-center">
              <canvas ref={canvasRef} className="block max-w-full h-auto" style={{ imageRendering: "auto" }} />
            </div>
          )}

          {!loading && !err && kind === "image" && blobUrl && (
            <div className="w-full flex items-start justify-center">
              <img src={blobUrl} alt={fileName} className="block max-w-full h-auto rounded" />
            </div>
          )}

          {!loading && !err && kind === "text" && (
            <pre className="text-xs whitespace-pre-wrap bg-black/5 dark:bg-white/5 p-3 rounded max-w-full overflow-x-auto">
{String(textContent || "")}
            </pre>
          )}

          {!loading && !err && kind === "unknown" && (
            <div className="text-sm space-y-3">
              <div>Type de fichier non prévisualisable.</div>
              <div>Tu peux le <b>télécharger</b> ou l’<b>ouvrir dans un onglet</b>.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
