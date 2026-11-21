import { Download, ExternalLink } from 'lucide-react';
import { DOCUMENT_META, PDF_ASSET_PATH } from '../data/scenarioData';

export function PdfViewerView() {
  return (
    <div className="space-y-4 pb-8">
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-[#0E2439]">
            Naskah PDF Asli — {DOCUMENT_META.title}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dokumen referensi 6 halaman UPBU Kelas III Tanjung Api — Ampana
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={PDF_ASSET_PATH}
            download="Skenario_TTX_Bandara_Tanjung_Api.pdf"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh PDF</span>
          </a>
          <a
            href={PDF_ASSET_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Buka Tab Baru</span>
          </a>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden h-[calc(100vh-190px)] min-h-[560px]">
        <iframe
          src={PDF_ASSET_PATH}
          title="Naskah Skenario Table Top Exercise Bandara Tanjung Api"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
