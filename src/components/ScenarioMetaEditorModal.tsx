import { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { ScenarioMeta } from '../types/ttx';
import { DEFAULT_SCENARIO_META } from '../data/scenarioData';

interface ScenarioMetaEditorModalProps {
  isOpen: boolean;
  meta: ScenarioMeta;
  onClose: () => void;
  onSave: (updated: ScenarioMeta) => void;
}

export function ScenarioMetaEditorModal({
  isOpen,
  meta,
  onClose,
  onSave,
}: ScenarioMetaEditorModalProps) {
  const [unit, setUnit] = useState(meta.unit);
  const [title, setTitle] = useState(meta.title);
  const [description, setDescription] = useState(meta.description);
  const [status, setStatus] = useState(meta.status);
  const [callSign, setCallSign] = useState(meta.callSign);
  const [aircraft, setAircraft] = useState(meta.aircraft);
  const [route, setRoute] = useState(meta.route);
  const [etaRunway, setEtaRunway] = useState(meta.etaRunway);
  const [pob, setPob] = useState(meta.pob);
  const [fuel, setFuel] = useState(meta.fuel);

  useEffect(() => {
    if (!isOpen) return;
    setUnit(meta.unit);
    setTitle(meta.title);
    setDescription(meta.description);
    setStatus(meta.status);
    setCallSign(meta.callSign);
    setAircraft(meta.aircraft);
    setRoute(meta.route);
    setEtaRunway(meta.etaRunway);
    setPob(meta.pob);
    setFuel(meta.fuel);
  }, [isOpen, meta]);

  if (!isOpen) return null;

  const canSubmit =
    unit.trim().length > 0 &&
    title.trim().length > 0 &&
    status.trim().length > 0;

  const handleResetDefaults = () => {
    setUnit(DEFAULT_SCENARIO_META.unit);
    setTitle(DEFAULT_SCENARIO_META.title);
    setDescription(DEFAULT_SCENARIO_META.description);
    setStatus(DEFAULT_SCENARIO_META.status);
    setCallSign(DEFAULT_SCENARIO_META.callSign);
    setAircraft(DEFAULT_SCENARIO_META.aircraft);
    setRoute(DEFAULT_SCENARIO_META.route);
    setEtaRunway(DEFAULT_SCENARIO_META.etaRunway);
    setPob(DEFAULT_SCENARIO_META.pob);
    setFuel(DEFAULT_SCENARIO_META.fuel);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({
      unit: unit.trim(),
      title: title.trim(),
      description: description.trim(),
      status: status.trim(),
      callSign: callSign.trim(),
      aircraft: aircraft.trim(),
      route: route.trim(),
      etaRunway: etaRunway.trim(),
      pob: pob.trim(),
      fuel: fuel.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scenario-meta-editor-title"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="scenario-meta-editor-title"
              className="text-base font-bold text-[#0E2439]"
            >
              Edit Kartu Header Skenario
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Perubahan otomatis diterapkan ke halaman utama, Data Pokok, Ekspor PDF, Savestate, dan Cloud.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Group 1: Identitas Dokumen */}
            <div className="space-y-3.5">
              <div className="text-xs font-semibold text-[#0E2439] pb-1.5 border-b border-slate-200">
                Identitas &amp; Status Skenario
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Unit / Instansi
                </label>
                <input
                  type="text"
                  value={unit}
                  maxLength={250}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Contoh: Kantor Unit Penyelenggara Bandar Udara Kelas III Tanjung Api — Ampana"
                  required
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Judul Naskah Skenario
                  </label>
                  <input
                    type="text"
                    value={title}
                    maxLength={200}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Naskah Skenario Table Top Exercise (TTX)"
                    required
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Label Status Darurat
                  </label>
                  <input
                    type="text"
                    value={status}
                    maxLength={80}
                    onChange={(e) => setStatus(e.target.value)}
                    placeholder="FULL EMERGENCY"
                    required
                    className="w-full px-3 py-2 text-sm font-mono font-semibold text-[#DC2626] bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0E2439]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Deskripsi Singkat Skenario
                </label>
                <textarea
                  rows={3}
                  value={description}
                  maxLength={1000}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ringkasan alur naskah skenario..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                />
              </div>
            </div>

            {/* Group 2: Data Operasional */}
            <div className="space-y-3.5">
              <div className="text-xs font-semibold text-[#0E2439] pb-1.5 border-b border-slate-200">
                Data Operasional Penerbangan
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Call Sign
                  </label>
                  <input
                    type="text"
                    value={callSign}
                    maxLength={120}
                    onChange={(e) => setCallSign(e.target.value)}
                    placeholder="Contoh: CLB-412 / PK-CBA"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pesawat
                  </label>
                  <input
                    type="text"
                    value={aircraft}
                    maxLength={160}
                    onChange={(e) => setAircraft(e.target.value)}
                    placeholder="Contoh: Celebes Air · ATR 72-600"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Rute
                  </label>
                  <input
                    type="text"
                    value={route}
                    maxLength={200}
                    onChange={(e) => setRoute(e.target.value)}
                    placeholder="Contoh: Luwuk (LUW) — Ampana (VPM)"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ETA &amp; Landasan
                  </label>
                  <input
                    type="text"
                    value={etaRunway}
                    maxLength={160}
                    onChange={(e) => setEtaRunway(e.target.value)}
                    placeholder="Contoh: 10.15 WITA · RWY 12"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Personel (POB)
                  </label>
                  <input
                    type="text"
                    value={pob}
                    maxLength={160}
                    onChange={(e) => setPob(e.target.value)}
                    placeholder="Contoh: 54 Jiwa (50 Pax, 4 Kru)"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bahan Bakar
                  </label>
                  <input
                    type="text"
                    value={fuel}
                    maxLength={120}
                    onChange={(e) => setFuel(e.target.value)}
                    placeholder="Contoh: 1.800 Liter"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Kembalikan ke Bawaan</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="min-h-[40px] px-4 py-2 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
