import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ZoomIn, ZoomOut, RotateCw, FileText, AlertCircle, RefreshCw, Maximize2, ExternalLink } from 'lucide-react';
import { getSecureFileUrl, apiDownload } from '../../services/api-client';

export interface FileViewerModalProps {
  isOpen?: boolean;
  fileUrl: string | null;
  fileName?: string | null;
  onClose: () => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  isOpen = true,
  fileUrl,
  fileName,
  onClose
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const isPushedHistoryRef = useRef<boolean>(false);
  const activeBlobUrlRef = useRef<string | null>(null);

  const cleanFileName = fileName || (fileUrl ? fileUrl.split('/').pop()?.split('?')[0] : 'Receipt Document') || 'Document';

  // Determine file type helper
  const isImage = mimeType?.startsWith('image/') || /\.(jpe?g|png|webp|gif|svg|bmp)$/i.test(cleanFileName);
  const isPdf = mimeType === 'application/pdf' || /\.pdf$/i.test(cleanFileName);

  // Safe close handler that coordinates with history state
  const handleClose = useCallback(() => {
    if (isPushedHistoryRef.current) {
      isPushedHistoryRef.current = false;
      // If history was pushed for this modal, going back triggers popstate which will call onClose
      if (window.history.state?.inAppFileViewer) {
        window.history.back();
        return;
      }
    }
    onClose();
  }, [onClose]);

  // Handle SPA History & Browser / Android Back Button
  useEffect(() => {
    if (!isOpen) return;

    // Push a lightweight history entry so Android/browser back closes the modal
    if (!window.history.state?.inAppFileViewer) {
      window.history.pushState({ inAppFileViewer: true }, '');
      isPushedHistoryRef.current = true;
    }

    const handlePopState = () => {
      isPushedHistoryRef.current = false;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, handleClose]);

  // Fetch file as authenticated blob
  const loadFileBlob = useCallback(async () => {
    if (!fileUrl) {
      setError('No file URL provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setScale(1);
    setRotation(0);

    // Clean up previous blob
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }

    try {
      const secureUrl = getSecureFileUrl(fileUrl);
      const token = localStorage.getItem('theiakshi_auth_token');

      const response = await fetch(secureUrl, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Your session has expired. Please sign in again.');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to view this receipt.');
        }
        if (response.status === 404) {
          throw new Error('The requested receipt file was not found or is unavailable.');
        }
        throw new Error(`Failed to load file (HTTP ${response.status}).`);
      }

      const contentType = response.headers.get('content-type') || '';
      setMimeType(contentType);

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      activeBlobUrlRef.current = objectUrl;
      setBlobUrl(objectUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to load file preview.');
    } finally {
      setLoading(false);
    }
  }, [fileUrl]);

  useEffect(() => {
    if (isOpen && fileUrl) {
      loadFileBlob();
    }

    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, [isOpen, fileUrl, loadFileBlob]);

  const handleDownload = () => {
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = cleanFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[7000] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      {/* Container: Fullscreen on mobile, centered rounded lightbox on desktop */}
      <div className="w-full h-full sm:max-w-5xl sm:h-[90vh] bg-slate-900 border-0 sm:border border-slate-800 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-800 shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">{cleanFileName}</h3>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {mimeType || (isPdf ? 'PDF Document' : isImage ? 'Image Document' : 'Receipt Document')}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isImage && blobUrl && !loading && !error && (
              <>
                <button
                  type="button"
                  onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono text-slate-400 px-1 hidden sm:inline">{Math.round(scale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setScale(s => Math.min(3, s + 0.25))}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            {blobUrl && !loading && (
              <button
                type="button"
                onClick={handleDownload}
                className="px-2.5 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download Receipt"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="p-2 sm:p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
              title="Close Viewer (Esc / Back)"
              aria-label="Close Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 bg-slate-950/60 overflow-auto flex items-center justify-center p-2 sm:p-4 relative min-h-0">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-xs text-slate-300 font-medium">Loading document...</p>
            </div>
          )}

          {error && !loading && (
            <div className="max-w-md p-6 bg-rose-950/40 border border-rose-800/80 rounded-2xl text-center space-y-3 m-4">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Unable to View Document</h4>
                <p className="text-xs text-rose-300">{error}</p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={loadFileBlob}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {!loading && !error && blobUrl && (
            <>
              {isImage ? (
                <div className="w-full h-full flex items-center justify-center overflow-auto p-2 select-none">
                  <img
                    src={blobUrl}
                    alt={cleanFileName}
                    style={{
                      transform: `scale(${scale}) rotate(${rotation}deg)`,
                      transition: 'transform 0.15s ease-out'
                    }}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              ) : isPdf ? (
                <div className="w-full h-full flex flex-col rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                  <object
                    data={blobUrl}
                    type="application/pdf"
                    className="w-full h-full"
                  >
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-3">
                      <FileText className="w-12 h-12 text-cyan-400" />
                      <p className="text-xs text-slate-300">
                        PDF preview is not supported directly in your browser.
                      </p>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold"
                      >
                        Download PDF
                      </button>
                    </div>
                  </object>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-sm">
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-cyan-400">
                    <FileText className="w-12 h-12" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{cleanFileName}</h4>
                    <p className="text-xs text-slate-400 mt-1">This file format can be downloaded and opened securely on your device.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
