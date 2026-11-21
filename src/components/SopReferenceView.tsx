import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type {
  EmergencyFactItem,
  IncidentNarrative,
  PhaseId,
  ScenarioMeta,
  SopItem,
} from '../types/ttx';
import {
  EMERGENCY_FACTS,
  SCENARIO_PHASES,
  TACTICAL_ZONES,
  TRIAGE_CATEGORIES,
} from '../data/scenarioData';
import { PhaseSopTable } from './PhaseSopTable';

interface SopReferenceViewProps {
  scenarioMeta: ScenarioMeta;
  sopItems: SopItem[];
  incidentNarrative: IncidentNarrative;
  canEdit: boolean;
  onAddSop: (phaseId: PhaseId) => void;
  onEditSop: (sop: SopItem) => void;
  onRequestDeleteSop: (sop: SopItem) => void;
  onMoveSop: (sopId: string, direction: 'up' | 'down') => void;
  onDropReorderSop: (sourceSopId: string, targetSopId: string) => void;
  onEditNarrative: () => void;
  onEditScenarioMeta: () => void;
}

export function SopReferenceView({
  scenarioMeta,
  sopItems,
  incidentNarrative,
  canEdit,
  onAddSop,
  onEditSop,
  onRequestDeleteSop,
  onMoveSop,
  onDropReorderSop,
  onEditNarrative,
  onEditScenarioMeta,
}: SopReferenceViewProps) {
  const [selectedPhase, setSelectedPhase] = useState<'all' | PhaseId>('all');

  const totalCasualties = TRIAGE_CATEGORIES.reduce((sum, c) => sum + c.count, 0);

  const syncedFacts: EmergencyFactItem[] = [
    { label: 'Pesawat / Operator', value: scenarioMeta.aircraft || '—' },
    { label: 'Nomor Penerbangan / Call Sign', value: scenarioMeta.callSign || '—' },
    { label: 'Rute Penerbangan', value: scenarioMeta.route || '—' },
    {
      label: 'Status Keadaan Darurat',
      value: scenarioMeta.status || '—',
      isCritical: true,
    },
    { label: 'Jumlah Personel (POB)', value: scenarioMeta.pob || '—' },
    { label: 'Sisa Bahan Bakar (Fuel)', value: scenarioMeta.fuel || '—' },
    { label: 'ETA & Landas Pacu Aktif', value: scenarioMeta.etaRunway || '—' },
    EMERGENCY_FACTS[7],
  ];

  const visiblePhases =
    selectedPhase === 'all'
      ? SCENARIO_PHASES
      : SCENARIO_PHASES.filter((p) => p.id === selectedPhase);

  return (
    <div className="space-y-8 pb-16">
      {/* Section I: Data Pokok */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs text-slate-500">{scenarioMeta.unit}</div>
            <h1 className="text-lg font-bold text-[#0E2439] mt-0.5">
              I. Data Pokok Keadaan Darurat
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs text-slate-500">Halaman 1</span>
            {canEdit && (
              <button
                type="button"
                onClick={onEditScenarioMeta}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0E2439] bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Header</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          <div className="divide-y divide-slate-200">
            {syncedFacts.slice(0, 4).map((fact) => (
              <div
                key={fact.label}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
              >
                <span className="text-xs font-medium text-slate-500">
                  {fact.label}
                </span>
                <span
                  className={`text-sm ${
                    fact.isCritical
                      ? 'font-mono font-semibold text-[#DC2626]'
                      : 'font-semibold text-slate-900'
                  }`}
                >
                  {fact.value}
                </span>
              </div>
            ))}
          </div>
          <div className="divide-y divide-slate-200 border-t md:border-t-0 border-slate-200">
            {syncedFacts.slice(4, 8).map((fact) => (
              <div
                key={fact.label}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
              >
                <span className="text-xs font-medium text-slate-500">
                  {fact.label}
                </span>
                <span className="text-sm font-semibold text-slate-900 tabular-nums">
                  {fact.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50/70">
          <div className="text-xs font-semibold text-slate-700 mb-1">
            {EMERGENCY_FACTS[8].label}
          </div>
          <p className="text-sm leading-relaxed text-slate-700">
            {EMERGENCY_FACTS[8].value}
          </p>
        </div>
      </section>

      {/* Section IV: Touchdown Narrative (Synced & Editable) */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="text-base font-bold text-[#0E2439]">
              IV. {incidentNarrative.title}
            </h2>
            <div className="font-mono text-xs text-slate-500 tabular-nums mt-0.5">
              {incidentNarrative.time} · Hal. {incidentNarrative.pageNumber}
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={onEditNarrative}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0E2439] bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Narasi</span>
            </button>
          )}
        </div>
        <p className="text-sm leading-relaxed text-slate-700 max-w-[85ch]">
          {incidentNarrative.body}
        </p>
      </section>

      {/* Section V: ICAO Doc 9137 Part 7 Tactical Zones */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#0E2439]">
              V. Tata Letak, Jarak Standar, &amp; Penugasan Pos Taktis Lapangan
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Zonasi Darurat (Hot, Warm, Cold Zone) dan Alur Evakuasi Korban sesuai ICAO Doc 9137 Part 7
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500">Hal. 4–5</span>
        </div>

        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {TACTICAL_ZONES.map((zone) => {
              const zoneAccent =
                zone.zoneLevel === 'hot'
                  ? 'text-[#DC2626]'
                  : zone.zoneLevel === 'warm'
                    ? 'text-[#B45309]'
                    : 'text-[#0284C7]';
              return (
                <div
                  key={zone.name}
                  className="bg-white border border-slate-200 rounded-md p-3.5"
                >
                  <div
                    className={`font-mono text-xs font-semibold tabular-nums ${zoneAccent}`}
                  >
                    {zone.distance}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">
                    {zone.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {zone.zoneLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="px-5 py-3 w-[190px]">Pos / Area</th>
                <th className="px-4 py-3 w-[170px]">Jarak &amp; Zonasi</th>
                <th className="px-4 py-3">Fungsi Operasional</th>
                <th className="px-5 py-3 w-[250px]">Penanggung Jawab</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {TACTICAL_ZONES.map((zone) => (
                <tr key={zone.name} className="align-top hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 font-semibold text-slate-900">
                    {zone.name}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {zone.distance}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {zone.zoneLabel}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-700 leading-relaxed text-[13px]">
                    {zone.functionDesc}
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 text-[13px] leading-relaxed">
                    {zone.responsibleUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section VI: Triage 54 POB */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#0E2439]">
              VI. Klasifikasi Triase Korban &amp; Rujukan Evakuasi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Total manifest {totalCasualties} jiwa (50 penumpang, 4 kru pesawat CLB-412)
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            Total POB: {totalCasualties} Jiwa
          </span>
        </div>

        <div className="divide-y divide-slate-200">
          {TRIAGE_CATEGORIES.map((cat) => {
            const labelColor =
              cat.id === 'red'
                ? 'text-[#DC2626]'
                : cat.id === 'yellow'
                  ? 'text-[#B45309]'
                  : cat.id === 'green'
                    ? 'text-[#15803D]'
                    : 'text-slate-900';

            return (
              <div
                key={cat.id}
                className="px-5 py-4 grid grid-cols-1 md:grid-cols-12 gap-4"
              >
                <div className="md:col-span-3">
                  <div className={`text-sm font-bold ${labelColor}`}>
                    {cat.label}
                  </div>
                  <div className="font-mono text-xs font-semibold text-slate-900 tabular-nums mt-0.5">
                    {cat.count} Orang · {cat.severity}
                  </div>
                </div>
                <ol className="md:col-span-9 space-y-1.5 text-[13px] text-slate-700 list-decimal pl-4 leading-relaxed">
                  {cat.actions.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live Synced & Editable SOP Tables */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#0E2439]">
              Rincian Tindakan Operasional Lapangan (SOP Tanggap Darurat)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {canEdit
                ? 'Sinkron langsung dengan halaman utama — perubahan dapat dilakukan di sini maupun di konsol utama'
                : 'Rincian tindakan operasional lapangan yang disinkronkan langsung dari skenario Admin'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedPhase}
              onChange={(e) =>
                setSelectedPhase(e.target.value as 'all' | PhaseId)
              }
              aria-label="Filter tahap SOP"
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-[#0E2439]"
            >
              <option value="all">Semua Tahap</option>
              {SCENARIO_PHASES.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.shortTitle}
                </option>
              ))}
            </select>

            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  onAddSop(selectedPhase === 'all' ? 'fase-2' : selectedPhase)
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah SOP</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {visiblePhases.map((phase) => {
            const items = sopItems.filter((s) => s.phaseId === phase.id);
            return (
              <PhaseSopTable
                key={phase.id}
                phaseId={phase.id}
                title={`${phase.roman}. ${phase.title}`}
                items={items}
                canEdit={canEdit}
                reorderingEnabled={canEdit}
                onAddSop={onAddSop}
                onEditSop={onEditSop}
                onRequestDeleteSop={onRequestDeleteSop}
                onMoveSop={onMoveSop}
                onDropReorderSop={onDropReorderSop}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
