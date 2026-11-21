import type {
  CommunicationBlock,
  DialogueItem,
  IncidentNarrative,
  PhaseId,
  PhaseSopPositions,
  ScenarioMeta,
  SopItem,
} from '../types/ttx';
import {
  DOCUMENT_META,
  EMERGENCY_FACTS,
  SCENARIO_PHASES,
} from '../data/scenarioData';
import { formatSequenceNumber } from '../lib/formatters';

interface PrintDocumentViewProps {
  scenarioMeta: ScenarioMeta;
  blocks: CommunicationBlock[];
  dialogues: DialogueItem[];
  sopItems: SopItem[];
  sopPositions: PhaseSopPositions;
  incidentNarrative: IncidentNarrative;
}

function renderCleanTranscript(text: string) {
  const highlightTerms = ['MAYDAY MAYDAY MAYDAY', 'FULL EMERGENCY', 'Full Emergency!'];
  let parts: (string | { strong: string })[] = [text];

  for (const term of highlightTerms) {
    const next: (string | { strong: string })[] = [];
    for (const part of parts) {
      if (typeof part !== 'string') {
        next.push(part);
        continue;
      }
      const split = part.split(term);
      split.forEach((seg, idx) => {
        if (seg) next.push(seg);
        if (idx < split.length - 1) {
          next.push({ strong: term });
        }
      });
    }
    parts = next;
  }

  return parts.map((p, idx) =>
    typeof p === 'string' ? (
      <span key={idx}>{p}</span>
    ) : (
      <strong key={idx} className="font-bold text-[#991B1B]">
        {p.strong}
      </strong>
    ),
  );
}

export function PrintDocumentView({
  scenarioMeta,
  blocks,
  dialogues,
  sopItems,
  sopPositions,
  incidentNarrative,
}: PrintDocumentViewProps) {
  const renderBlockForPrint = (block: CommunicationBlock) => {
    const entries = dialogues.filter((d) => d.blockId === block.id);
    if (entries.length === 0) return null;

    return (
      <div
        key={block.id}
        className="border border-slate-300 rounded-sm overflow-hidden mb-4"
      >
        <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-300 flex items-baseline justify-between gap-2 print-break-after-avoid">
          <div>
            <span className="font-mono text-[11px] font-semibold text-[#0E2439] mr-1.5">
              {block.code}
            </span>
            <span className="text-[12.5px] font-bold text-slate-900">
              {block.title}
            </span>
          </div>
          <span className="text-[10.5px] text-slate-600 shrink-0">
            {block.channelType}
          </span>
        </div>

        <div className="divide-y divide-slate-200">
          {entries.map((entry) => {
            if (entry.entryType === 'narrative') {
              return (
                <div
                  key={entry.id}
                  className="px-3.5 py-2.5 bg-slate-50 print-avoid-break"
                >
                  <div className="text-[11.5px] font-bold text-[#0E2439] mb-0.5">
                    {entry.title ? entry.title : 'Narasi Skenario'}
                  </div>
                  <p className="text-[11.5px] leading-[1.55] text-slate-800 whitespace-pre-line">
                    {entry.transcript}
                  </p>
                  {entry.note && (
                    <p className="text-[10.5px] text-slate-600 mt-1 italic">
                      Catatan: {entry.note}
                    </p>
                  )}
                </div>
              );
            }

            return (
              <div
                key={entry.id}
                className="px-3.5 py-2.5 bg-white print-avoid-break"
              >
                <div className="text-[11.5px] leading-[1.55] text-slate-900">
                  <span className="font-mono text-[10.5px] text-slate-500 mr-1.5 tabular-nums">
                    {formatSequenceNumber(entry.sequenceNumber)}.
                  </span>
                  <strong className="font-bold text-[#0E2439]">
                    {entry.sender} — {entry.receiver}:
                  </strong>{' '}
                  <span>{renderCleanTranscript(entry.transcript)}</span>
                </div>
                {entry.note && (
                  <p className="text-[10.5px] text-slate-600 mt-1 pl-6 italic">
                    Catatan: {entry.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSopTableForPrint = (phaseId: PhaseId) => {
    const phaseSops = sopItems.filter((s) => s.phaseId === phaseId);
    if (phaseSops.length === 0) return null;

    const headerLabel =
      phaseId === 'fase-6'
        ? 'Rincian Tindakan Penutupan Operasi & Pemulihan Bandara (Recovery)'
        : 'Rincian Tindakan Operasional Lapangan (SOP Tanggap Darurat)';

    return (
      <div className="mb-4">
        <table className="w-full border-collapse border border-slate-300 text-left">
          <thead>
            <tr className="bg-[#0E2439] text-white">
              <th className="px-3 py-2 text-[11px] font-bold border border-slate-400 w-[28%]">
                Petugas / Unit
              </th>
              <th className="px-3 py-2 text-[11px] font-bold border border-slate-400">
                {headerLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {phaseSops.map((sop) => (
              <tr key={sop.id} className="align-top print-avoid-break">
                <td className="px-3 py-2.5 text-[11.5px] font-bold text-[#0E2439] border border-slate-300 bg-slate-50/70">
                  {sop.unit}
                </td>
                <td className="px-3 py-2.5 text-[11.5px] leading-[1.5] text-slate-800 border border-slate-300">
                  <ol className="list-decimal pl-4 space-y-1">
                    {sop.steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="hidden print:block bg-white text-[#0F172A] text-[12px]">
      {/* Official Document Kop */}
      <header className="text-center pb-3 mb-5 border-b-2 border-[#0E2439]">
        <div className="text-[11px] font-bold tracking-wide text-slate-900 uppercase">
          {DOCUMENT_META.ministry}
        </div>
        <div className="text-[11px] font-bold tracking-wide text-slate-900 uppercase">
          {DOCUMENT_META.directorate}
        </div>
        <div className="text-[11.5px] text-slate-700 mt-0.5">
          {scenarioMeta.unit}
        </div>
        <h1 className="text-[16px] font-bold text-[#0E2439] mt-2 tracking-tight">
          {scenarioMeta.title}
        </h1>
        <div className="text-[11.5px] text-slate-700">
          {DOCUMENT_META.subtitle}
        </div>
      </header>

      {/* Section I: Data Pokok Keadaan Darurat */}
      <section className="mb-6 print-avoid-break">
        <h2 className="text-[13px] font-bold text-[#0E2439] mb-2 uppercase tracking-wide">
          I. Data Pokok Keadaan Darurat
        </h2>
        <table className="w-full border-collapse border border-slate-300 text-[11.5px]">
          <tbody>
            <tr>
              <td className="px-3 py-2 font-semibold bg-slate-50 border border-slate-300 w-[23%]">
                {EMERGENCY_FACTS[0].label}
              </td>
              <td className="px-3 py-2 border border-slate-300 w-[27%]">
                {scenarioMeta.aircraft || '—'}
              </td>
              <td className="px-3 py-2 font-semibold bg-slate-50 border border-slate-300 w-[23%]">
                {EMERGENCY_FACTS[1].label}
              </td>
              <td className="px-3 py-2 font-mono font-semibold border border-slate-300 w-[27%]">
                {scenarioMeta.callSign || '—'}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-semibold bg-slate-50 border border-slate-300">
                {EMERGENCY_FACTS[2].label}
              </td>
              <td className="px-3 py-2 border border-slate-300">
                {scenarioMeta.route || '—'}
              </td>
              <td className="px-3 py-2 font-semibold bg-slate-50 border border-slate-300">
                {EMERGENCY_FACTS[3].label}
              </td>
              <td className="px-3 py-2 border border-slate-300">
                <span className="inline-block px-1.5 py-0.5 border border-[#DC2626] text-[#DC2626] font-mono text-[10.5px] font-bold">
                  {scenarioMeta.status || '—'}
                </span>
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-semibold bg-slate-50 border border-slate-300">
                {EMERGENCY_FACTS[4].label}
              </td>
              <td className="px-3 py-2 border border-slate-300">
                {scenarioMeta.pob || '—'}
              </td>
              <td className="px-3 py-2 font-semibold bg-slate-50 border border-slate-300">
                {EMERGENCY_FACTS[5].label}
              </td>
              <td className="px-3 py-2 border border-slate-300">
                {scenarioMeta.fuel || '—'}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-semibold bg-slate-50 border border-slate-300">
                ETA &amp; Landasan
              </td>
              <td className="px-3 py-2 border border-slate-300 font-mono">
                {scenarioMeta.etaRunway || '—'}
              </td>
              <td className="px-3 py-2 font-semibold bg-slate-50 border border-slate-300">
                {EMERGENCY_FACTS[7].label}
              </td>
              <td className="px-3 py-2 border border-slate-300">
                {EMERGENCY_FACTS[7].value}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-semibold bg-slate-50 border border-slate-300">
                {EMERGENCY_FACTS[8].label}
              </td>
              <td colSpan={3} className="px-3 py-2 border border-slate-300 leading-relaxed">
                {EMERGENCY_FACTS[8].value}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Phases II, III, IV, VI matching main console interleaved block & SOP order */}
      {SCENARIO_PHASES.map((phase) => {
        const phaseBlocks = blocks.filter((b) => b.phaseId === phase.id);
        const fallbackSopPos = phase.id === 'fase-4' ? 0 : phaseBlocks.length;
        const clampedSopPos = Math.max(
          0,
          Math.min(
            phaseBlocks.length,
            sopPositions[phase.id] ?? fallbackSopPos,
          ),
        );
        const blocksBeforeSop = phaseBlocks.slice(0, clampedSopPos);
        const blocksAfterSop = phaseBlocks.slice(clampedSopPos);

        return (
          <section key={phase.id} className="mb-6">
            <h2 className="text-[13px] font-bold text-[#0E2439] pb-1 mb-3 border-b border-[#0E2439]/40 uppercase tracking-wide print-break-after-avoid">
              {phase.roman}. {phase.title}
            </h2>

            {phase.id === 'fase-4' && (
              <div className="mb-4 p-3.5 border border-slate-300 rounded-sm bg-slate-50 print-avoid-break">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-[12px] font-bold text-[#0E2439]">
                    {incidentNarrative.title}
                  </span>
                  <span className="font-mono text-[10.5px] text-slate-600">
                    {incidentNarrative.time}
                  </span>
                </div>
                <p className="text-[11.5px] leading-[1.6] text-slate-800 whitespace-pre-line">
                  {incidentNarrative.body}
                </p>
              </div>
            )}

            {blocksBeforeSop.map((blk) => renderBlockForPrint(blk))}
            {renderSopTableForPrint(phase.id)}
            {blocksAfterSop.map((blk) => renderBlockForPrint(blk))}
          </section>
        );
      })}
    </div>
  );
}
