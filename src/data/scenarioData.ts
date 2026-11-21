import type {
  CommunicationBlock,
  DialogueItem,
  EmergencyFactItem,
  ScenarioMeta,
  ScenarioPhase,
  SopItem,
  TacticalZone,
  TriageCategory,
} from '../types/ttx';

export const PDF_ASSET_PATH =
  '/assets/aistudio/Skenario_Table_Top_Exercise_-_Bandara_Tanjung_Api__4___1__b61ddbf2.pdf';

export const DOCUMENT_META = {
  ministry: 'Kementerian Perhubungan Republik Indonesia',
  directorate: 'Direktorat Jenderal Perhubungan Udara',
  unit: 'Kantor Unit Penyelenggara Bandar Udara Kelas III Tanjung Api — Ampana',
  title: 'Naskah Skenario Table Top Exercise (TTX)',
  subtitle: 'Penanggulangan Keadaan Darurat Penerbangan (Airport Emergency Plan)',
  callSign: 'CLB-412 / PK-CBA',
  aircraft: 'Celebes Air · ATR 72-600',
  route: 'Luwuk (LUW) — Ampana (VPM)',
  eta: '10.15 WITA',
  runway: 'Runway 12 (120° / 06 Kts)',
  pob: '54 Jiwa (50 Pax, 4 Kru)',
  fuel: '1.800 Liter',
  status: 'FULL EMERGENCY',
};

export const DEFAULT_SCENARIO_META: ScenarioMeta = {
  unit: DOCUMENT_META.unit,
  title: DOCUMENT_META.title,
  description:
    'Alur lengkap percakapan audio, narasi blok & dinamika kejadian, serta rincian SOP Tanggap Darurat yang seluruhnya dapat diedit, diurutkan, dan diekspor ke PDF.',
  status: DOCUMENT_META.status,
  callSign: DOCUMENT_META.callSign,
  aircraft: DOCUMENT_META.aircraft,
  route: DOCUMENT_META.route,
  etaRunway: `${DOCUMENT_META.eta} · RWY 12`,
  pob: DOCUMENT_META.pob,
  fuel: DOCUMENT_META.fuel,
};

export const EMERGENCY_FACTS: EmergencyFactItem[] = [
  { label: 'Pesawat / Operator', value: 'Celebes Air / ATR 72-600' },
  { label: 'Nomor Penerbangan / Call Sign', value: 'CLB-412 / PK-CBA' },
  { label: 'Rute Penerbangan', value: 'Luwuk (LUW) — Ampana (VPM)' },
  { label: 'Status Keadaan Darurat', value: 'FULL EMERGENCY', isCritical: true },
  { label: 'Jumlah Personel (POB)', value: '54 Jiwa (50 Pax, 4 Kru)' },
  { label: 'Sisa Bahan Bakar (Fuel)', value: '1.800 Liter' },
  { label: 'Perkiraan Waktu Tiba (ETA)', value: 'Pukul 10.15 WITA' },
  { label: 'Landas Pacu Aktif (Runway)', value: 'Runway 12 (Angin: 120° / 06 Kts)' },
  {
    label: 'Deskripsi Masalah Teknis',
    value:
      'Kegagalan sistem hidrolik (Hydraulic Failure), indikator roda pendarat utama kanan tidak terkunci (Right Main Gear Unsafe), potensi gesekan dan kebakaran sayap kanan saat pendaratan.',
  },
];

export const SCENARIO_PHASES: ScenarioPhase[] = [
  {
    id: 'fase-2',
    roman: 'II',
    title: 'Fase Udara: Alur Komunikasi & Tindakan Kesiapsiagaan Awal',
    shortTitle: 'II. Fase Udara',
    summary:
      'Komunikasi radio VHF antara Pilot CLB-412, Tower (ATC), dan aktivasi siaga darurat ke Regu PKP-PK.',
    pageRange: 'Hal. 1–2',
  },
  {
    id: 'fase-3',
    roman: 'III',
    title: 'Rantai Komando, Notifikasi Berantai, & Tindakan Mobilisasi',
    shortTitle: 'III. Rantai Komando',
    summary:
      'Aktivasi cascade call dari Tower ke TOKPD, AVSEC, Kepala Kantor UPBU, KTU/KKP, serta mobilisasi instansi eksternal.',
    pageRange: 'Hal. 2–3',
  },
  {
    id: 'fase-4',
    roman: 'IV',
    title: 'Dinamika Kejadian Kecelakaan, Pemadaman Api, & Penyelamatan Kabin',
    shortTitle: 'IV. Insiden & MCP',
    summary:
      'Pendaratan darurat pukul 10.15 WITA di Runway 12, serah terima OSC di Mobile Command Post, dan instruksi water relay serta medis.',
    pageRange: 'Hal. 3–4',
  },
  {
    id: 'fase-6',
    roman: 'VI',
    title: 'Tindakan Pasca-Insiden, Triase Korban, Investigasi, & Normalisasi',
    shortTitle: 'VI. Penutupan Operasi',
    summary:
      'Laporan sterilisasi kabin oleh Komandan PKP-PK ke EOC, penutupan operasi pemadaman, dan pemulihan operasional bandara.',
    pageRange: 'Hal. 5–6',
  },
];

export const COMMUNICATION_BLOCKS: CommunicationBlock[] = [
  {
    id: 'blk-2a',
    phaseId: 'fase-2',
    code: 'Blok 2A',
    title: 'Komunikasi Radio Udara & Aktivasi PKP-PK',
    channelType: 'Frekuensi Tower (VHF) & Crash Phone',
    description:
      'Laporan awal pendekatan CLB-412, kegagalan hidrolik, deklarasi MAYDAY FULL EMERGENCY, hingga siaga armada PKP-PK di access road Runway 12.',
    pageNumber: 1,
  },
  {
    id: 'blk-3a',
    phaseId: 'fase-3',
    code: 'Blok 3A',
    title: 'Jalur TOKPD & Instansi Eksternal (Damkar, BPBD, Dishub, SAR)',
    channelType: 'Telepon Darurat & Radio Koordinasi',
    description:
      'Notifikasi Tower ke TOKPD dilanjutkan permintaan bantuan armada eksternal menuju Rendezvous Point Bandara.',
    pageNumber: 2,
  },
  {
    id: 'blk-3b',
    phaseId: 'fase-3',
    code: 'Blok 3B',
    title: 'Jalur AVSEC & Pengamanan TNI / POLRI',
    channelType: 'Radio Pengamanan & Jalur Komando',
    description:
      'Aktivasi pengamanan perimeter sisi udara serta perkuatan Koramil, Polres, dan tim DVI/Inafis.',
    pageNumber: 2,
  },
  {
    id: 'blk-3c',
    phaseId: 'fase-3',
    code: 'Blok 3C',
    title: 'Pelaporan Kepala Kantor UPBU & Aktivasi EOC',
    channelType: 'Jalur Pimpinan & EOC',
    description:
      'Pelaporan ke Kepala Kantor untuk penerbitan NOTAM penutupan aerodrome, penunjukan OSC, dan koordinasi Dirjen Hubud, Otban V, KNKT, serta Bupati.',
    pageNumber: 2,
  },
  {
    id: 'blk-3d',
    phaseId: 'fase-3',
    code: 'Blok 3D',
    title: 'Jalur KTU, Maskapai, KKP, Rumah Sakit & PMI',
    channelType: 'Koordinasi Medis & Terminal',
    description:
      'Penyiapan manifes penumpang, Family Holding Area, serta pengerahan ambulans RSUD Ampana, Puskesmas, dan PMI.',
    pageNumber: 2,
  },
  {
    id: 'blk-4a',
    phaseId: 'fase-4',
    code: 'Blok 4A',
    title: 'Instruksi Taktis On Scene Commander (MCP)',
    channelType: 'Radio Taktis Lapangan (MCP)',
    description:
      'Instruksi langsung OSC kepada Pengendali Staging Area setelah serah terima komando di Mobile Command Post.',
    pageNumber: 4,
  },
  {
    id: 'blk-6a',
    phaseId: 'fase-6',
    code: 'Blok 6A',
    title: 'Laporan Akhir Pemadaman & Evakuasi ke EOC',
    channelType: 'Radio Komando ke EOC',
    description:
      'Laporan resmi Komandan PKP-PK setelah overhaul inspection memastikan tidak ada titik api tersembunyi.',
    pageNumber: 5,
  },
];

export const INITIAL_DIALOGUES: DialogueItem[] = [
  // FASE II - BLOK 2A
  {
    id: 'dlg-01',
    sequenceNumber: 1,
    phaseId: 'fase-2',
    blockId: 'blk-2a',
    sender: 'Pilot',
    receiver: 'TW',
    transcript:
      'Tanjung Api Info, CLB-412 radial 110° 25 Nm passing 7.000 ft descending 3.000 ft.',
    pageNumber: 1,
    note: 'Kontak awal pesawat memasuki area pendekatan Bandara Tanjung Api.',
  },
  {
    id: 'dlg-02',
    sequenceNumber: 2,
    phaseId: 'fase-2',
    blockId: 'blk-2a',
    sender: 'TW',
    receiver: 'Pilot',
    transcript:
      'CLB-412 copied, QAM: wind 120°/06 Kts, Vis 10 Km, QNH 1010, Runway in use 12, report runway in sight.',
    pageNumber: 1,
    note: 'Informasi cuaca aktual (QAM) dan landas pacu aktif Runway 12.',
  },
  {
    id: 'dlg-03',
    sequenceNumber: 3,
    phaseId: 'fase-2',
    blockId: 'blk-2a',
    sender: 'Pilot',
    receiver: 'TW',
    transcript:
      'Runway in sight. Tanjung Api, CLB-412 kami mengalami hydraulic failure, right main gear transit/unsafe. Request holding 10 menit untuk emergency checklist.',
    pageNumber: 1,
    note: 'Laporan awal gangguan hidrolik dan indikator roda pendarat utama kanan.',
  },
  {
    id: 'dlg-04',
    sequenceNumber: 4,
    phaseId: 'fase-2',
    blockId: 'blk-2a',
    sender: 'TW',
    receiver: 'Pilot',
    transcript:
      'CLB-412 copied, holding over Ampana overhead 3.000 ft, report ready for approach.',
    pageNumber: 1,
    note: 'Izin holding di atas Ampana pada ketinggian 3.000 kaki.',
  },
  {
    id: 'dlg-05',
    sequenceNumber: 5,
    phaseId: 'fase-2',
    blockId: 'blk-2a',
    sender: 'Pilot',
    receiver: 'TW',
    transcript:
      'MAYDAY MAYDAY MAYDAY, CLB-412 right main gear unable to lock down, declare FULL EMERGENCY. Request landing Runway 12, POB 54, fuel 1.800 L, request fire fighting services standby!',
    isEmergencyPriority: true,
    pageNumber: 1,
    note: 'Deklarasi kondisi darurat penuh (Full Emergency) dan permintaan siaga PKP-PK.',
  },
  {
    id: 'dlg-06',
    sequenceNumber: 6,
    phaseId: 'fase-2',
    blockId: 'blk-2a',
    sender: 'TW',
    receiver: 'Pilot',
    transcript:
      'CLB-412 roger Mayday, runway 12 clear for landing, wind 120°/06 Kts, rescue and fire fighting standby.',
    isEmergencyPriority: true,
    pageNumber: 1,
    note: 'Prioritas pendaratan bebas hambatan di Runway 12.',
  },
  {
    id: 'dlg-07',
    sequenceNumber: 7,
    phaseId: 'fase-2',
    blockId: 'blk-2a',
    sender: 'TW',
    receiver: 'PKP-PK',
    transcript:
      'Full Emergency! CLB-412 rute Luwuk-Ampana, gear kanan tidak terkunci, ETA 10.15 WITA, Runway 12, POB 54, fuel 1.800 L. Personel segera siaga!',
    isEmergencyPriority: true,
    pageNumber: 1,
    note: 'Diikuti penekanan Crash Bell / Crash Phone ke stasiun PKP-PK.',
  },
  {
    id: 'dlg-08',
    sequenceNumber: 8,
    phaseId: 'fase-2',
    blockId: 'blk-2a',
    sender: 'PKP-PK',
    receiver: 'TW',
    transcript:
      'Dicopy, seluruh armada dan personel PKP-PK segera meluncur dan bersiaga di access road Runway 12.',
    pageNumber: 1,
    note: 'Response time armada PKP-PK menuju posisi siaga < 2 menit.',
  },

  // FASE III - BLOK 3A (TOKPD & Eksternal)
  {
    id: 'dlg-09',
    sequenceNumber: 9,
    phaseId: 'fase-3',
    blockId: 'blk-3a',
    sender: 'TW',
    receiver: 'TOKPD',
    transcript:
      'Full Emergency, Celebes Air CLB-412 ATR 72-600 rute Luwuk-Ampana, kegagalan hidrolik/roda kanan, ETA 10.15 Runway 12, POB 54, fuel 1.800 L.',
    isEmergencyPriority: true,
    pageNumber: 2,
  },
  {
    id: 'dlg-10',
    sequenceNumber: 10,
    phaseId: 'fase-3',
    blockId: 'blk-3a',
    sender: 'TOKPD',
    receiver: 'TW',
    transcript:
      'Dicopy. Personel PKP-PK bersiaga penuh sesuai SOP, saya segera menghubungi instansi bantuan eksternal.',
    pageNumber: 2,
  },
  {
    id: 'dlg-11',
    sequenceNumber: 11,
    phaseId: 'fase-3',
    blockId: 'blk-3a',
    sender: 'TOKPD',
    receiver: 'Instansi Eksternal',
    transcript:
      'Selamat pagi, terjadi Full Emergency di Bandara Tanjung Api, pesawat ATR 72-600 kerusakan roda pendarat, ETA 10.15 Runway 12, POB 54. Mohon bantuan unit Damkar Pemda, BPBD, Dishub, dan Pos SAR merapat ke Rendezvous Point Bandara!',
    isEmergencyPriority: true,
    pageNumber: 2,
  },
  {
    id: 'dlg-12',
    sequenceNumber: 12,
    phaseId: 'fase-3',
    blockId: 'blk-3a',
    sender: 'Damkar, BPBD, SAR',
    receiver: 'TOKPD',
    transcript:
      'Baik dicopy, tim dan armada evakuasi segera meluncur ke lokasi bandara.',
    pageNumber: 2,
  },

  // FASE III - BLOK 3B (AVSEC & TNI/POLRI)
  {
    id: 'dlg-13',
    sequenceNumber: 13,
    phaseId: 'fase-3',
    blockId: 'blk-3b',
    sender: 'TW',
    receiver: 'AVSEC',
    transcript:
      'Diinformasikan Full Emergency pesawat Celebes Air CLB-412 kerusakan roda pendarat kanan, ETA 10.15 Runway 12, POB 54.',
    pageNumber: 2,
  },
  {
    id: 'dlg-14',
    sequenceNumber: 14,
    phaseId: 'fase-3',
    blockId: 'blk-3b',
    sender: 'AVSEC',
    receiver: 'TW',
    transcript:
      'Baik dicopy, personel AVSEC diterjunkan mengamankan perimeter dan titik kritis sesuai prosedur.',
    pageNumber: 2,
  },
  {
    id: 'dlg-15',
    sequenceNumber: 15,
    phaseId: 'fase-3',
    blockId: 'blk-3b',
    sender: 'AVSEC',
    receiver: 'TNI & POLRI',
    transcript:
      'Selamat pagi, Full Emergency di Bandara Tanjung Api pendaratan darurat POB 54 orang. Mohon perkuatan perimeter dan tim DVI/Inafis merapat ke Pos Pengamanan.',
    pageNumber: 2,
  },
  {
    id: 'dlg-16',
    sequenceNumber: 16,
    phaseId: 'fase-3',
    blockId: 'blk-3b',
    sender: 'Koramil & Polres',
    receiver: 'AVSEC',
    transcript:
      'Siap, regu pengamanan jalur evakuasi dan identifikasi segera merapat.',
    pageNumber: 2,
  },

  // FASE III - BLOK 3C (Kepala Kantor UPBU)
  {
    id: 'dlg-17',
    sequenceNumber: 17,
    phaseId: 'fase-3',
    blockId: 'blk-3c',
    sender: 'TW',
    receiver: 'Kepala Kantor',
    transcript:
      'Lapor Bapak, terjadi Full Emergency pesawat Celebes Air CLB-412 rute Luwuk-Ampana malafungsi roda pendarat, ETA 10.15 Runway 12, POB 54, fuel 1.800 L.',
    isEmergencyPriority: true,
    pageNumber: 2,
  },
  {
    id: 'dlg-18',
    sequenceNumber: 18,
    phaseId: 'fase-3',
    blockId: 'blk-3c',
    sender: 'Kepala Kantor',
    receiver: 'TW',
    transcript:
      'Dicopy. Terbitkan NOTAM penutupan aerodrome sementara. Aktifkan EOC, saya tunjuk Ketua Tim TOKPD sebagai On Scene Commander (OSC). Saya koordinasikan ke Dirjen Hubud, Otban V, KNKT, dan Bupati Tojo Una-Una.',
    pageNumber: 2,
  },

  // FASE III - BLOK 3D (KTU, Maskapai, KKP, RS & PMI)
  {
    id: 'dlg-19',
    sequenceNumber: 19,
    phaseId: 'fase-3',
    blockId: 'blk-3d',
    sender: 'TW',
    receiver: 'KTU & KKP',
    transcript:
      'Full Emergency pesawat Celebes Air CLB-412 kerusakan roda kanan, ETA 10.15 Runway 12, POB 54.',
    pageNumber: 2,
  },
  {
    id: 'dlg-20',
    sequenceNumber: 20,
    phaseId: 'fase-3',
    blockId: 'blk-3d',
    sender: 'KTU',
    receiver: 'Maskapai',
    transcript:
      'Siapkan manifes penumpang dan Family Holding Area di gedung terminal.',
    pageNumber: 2,
  },
  {
    id: 'dlg-21',
    sequenceNumber: 21,
    phaseId: 'fase-3',
    blockId: 'blk-3d',
    sender: 'KKP',
    receiver: 'Rumah Sakit & PMI',
    transcript:
      'Selamat pagi, Full Emergency kecelakaan pendaratan pesawat di Bandara Tanjung Api, POB 54 potensi trauma benturan dan luka bakar. Mohon seluruh ambulans RSUD Ampana, Puskesmas, dan PMI segera menuju Rendezvous Point!',
    isEmergencyPriority: true,
    pageNumber: 2,
  },
  {
    id: 'dlg-22',
    sequenceNumber: 22,
    phaseId: 'fase-3',
    blockId: 'blk-3d',
    sender: 'RSUD, Puskesmas, PMI',
    receiver: 'KKP',
    transcript:
      'Baik dicopy, armada ambulans dan tim medis trauma segera bergerak ke lokasi.',
    pageNumber: 2,
  },

  // FASE IV - BLOK 4A (Instruksi OSC di MCP)
  {
    id: 'dlg-23',
    sequenceNumber: 23,
    phaseId: 'fase-4',
    blockId: 'blk-4a',
    sender: 'OSC (Ka Tim TOKPD)',
    receiver: 'Pengendali Staging Area',
    transcript:
      'Panggil 2 unit tangki Damkar Pemda untuk water relay ke Foam Tender PKP-PK, dan kirim seluruh tim medis ambulans menuju Triage dan Care Area!',
    isEmergencyPriority: true,
    pageNumber: 4,
    note: 'Instruksi langsung setelah pendirian Mobile Command Post (MCP) ±120m Upwind.',
  },

  // FASE VI - BLOK 6A (Laporan Akhir ke EOC)
  {
    id: 'dlg-24',
    sequenceNumber: 24,
    phaseId: 'fase-6',
    blockId: 'blk-6a',
    sender: 'Komandan PKP-PK',
    receiver: 'EOC',
    transcript: 'Operasi pemadaman dan evakuasi selesai, kabin pesawat steril.',
    pageNumber: 5,
    note: 'Dilaporkan pasca overhaul inspection menggunakan alat pengukur suhu inframerah.',
  },
];

export const TOUCHDOWN_NARRATIVE = {
  title: '1. Insiden Pendaratan (Touchdown & Crash)',
  time: 'Pukul 10.15 WITA · Runway 12',
  pageNumber: 3,
  body: 'Pukul 10.15 WITA, pesawat mendarat di Runway 12. Saat terjadi sentuhan roda, roda pendarat utama kanan patah (collapse). Gesekan sayap kanan dan tangki bahan bakar dengan permukaan aspal memicu kebakaran aktif. Pesawat tergelincir berputar 90 derajat ke kanan dan terhenti di bahu landasan (runway strip) dengan asap tebal membubung ke arah barat (angin dari timur 120° / 06 Knots).',
};

export const SOP_ITEMS: SopItem[] = [
  {
    id: 'sop-1',
    phaseId: 'fase-2',
    phaseTitle: 'II. Fase Udara — Kesiapsiagaan Awal',
    unit: 'Petugas Tower (ATC)',
    pageNumber: 1,
    steps: [
      'Menekan tombol sirene darurat (Crash Bell / Crash Phone) ke stasiun PKP-PK.',
      'Memberikan prioritas mutlak pendaratan bebas hambatan ke Runway 12, memandu pilot dengan informasi angin aktual dan QNH.',
      'Menghubungi simpul komando bandara (Kepala Kantor & EOC Coordinator) untuk mengaktifkan prosedur cascade call dan tidak meninggalkan konsol navigasi udara.',
    ],
  },
  {
    id: 'sop-2',
    phaseId: 'fase-2',
    phaseTitle: 'II. Fase Udara — Kesiapsiagaan Awal',
    unit: 'Regu PKP-PK (ARFF)',
    pageNumber: 2,
    steps: [
      'Membunyikan alarm internal stasiun pemadam, seluruh personel mengenakan APD lengkap (Fire Entry / Proximity Suit & SCBA).',
      'Menghidupkan armada kendaraan pemadam (Foam Tender & Rapid Intervention Vehicle) dan meluncur dalam waktu < 2 menit menuju posisi siaga darurat di access road Runway 12.',
      'Komandan Regu PKP-PK mengambil alih peran sebagai Initial On Scene Commander (Initial OSC) di lapangan dan memeriksa tekanan monitor/turret busa pemadam.',
    ],
  },
  {
    id: 'sop-3',
    phaseId: 'fase-3',
    phaseTitle: 'III. Rantai Komando & Mobilisasi',
    unit: 'Kepala Kantor UPBU & Tim EOC',
    pageNumber: 3,
    steps: [
      'Membuka dan mengaktifkan ruang EOC (Emergency Operations Centre), mengundang seluruh Liaison Officer (LO) instansi eksternal.',
      'Menerbitkan NOTAM penutupan landasan sementara waktu akibat keadaan darurat.',
      'Mengesahkan penunjukan Ketua Tim TOKPD sebagai On Scene Commander (OSC) dan mengendalikan aliran informasi publik/media melalui satu pintu resmi (Humas UPBU).',
    ],
  },
  {
    id: 'sop-4',
    phaseId: 'fase-3',
    phaseTitle: 'III. Rantai Komando & Mobilisasi',
    unit: 'Personel AVSEC & TNI/Polri',
    pageNumber: 3,
    steps: [
      'Membagi regu ke 5 titik pengamanan: Pos Gerbang Utama, Gedung Terminal, Rendezvous Point (depan Admin), Staging Area (depan Bangland), dan Gerbang Darurat Runway.',
      'Menutup perimeter sisi udara (airside) dari pihak yang tidak berkepentingan.',
      'Menerima instansi bantuan di Rendezvous Point, mencatat jumlah armada/personel, dan mengawal konvoi kendaraan bantuan menuju Staging Area.',
      'Satlantas Polres mensterilkan jalur jalan raya protokol dari gerbang bandara menuju RSUD Ampana untuk rute prioritas ambulans.',
    ],
  },
  {
    id: 'sop-5',
    phaseId: 'fase-3',
    phaseTitle: 'III. Rantai Komando & Mobilisasi',
    unit: 'Instansi Eksternal (Damkar Pemda, SAR, Medis)',
    pageNumber: 3,
    steps: [
      'Tiba melalui gerbang darurat menuju Rendezvous Point, tidak diperkenankan langsung menerobos ke landas pacu.',
      'Mengikuti panduan kendaraan pengawal AVSEC menuju Staging Area di depan Bangland.',
      'Memarkir armada dengan posisi menghadap arah evakuasi, mesin tetap menyala (engine running), dan menunggu komando panggilan dari OSC di Mobile Command Post (MCP).',
    ],
  },
  {
    id: 'sop-6',
    phaseId: 'fase-3',
    phaseTitle: 'III. Rantai Komando & Mobilisasi',
    unit: 'Tata Usaha, Maskapai, & BKK/KKP',
    pageNumber: 3,
    steps: [
      'KTU bersama maskapai mendirikan Family Holding Area (ruang tunggu keluarga korban) dan menyiapkan posko informasi manifes.',
      'Dokter BKK/KKP bersama perawat RSUD dan PMI menyiapkan peralatan triase (tag Merah, Kuning, Hijau, Hitam), tandu lipat, oksigen darurat, dan tenda perawatan lapangan.',
    ],
  },
  {
    id: 'sop-7',
    phaseId: 'fase-4',
    phaseTitle: 'IV. Pemadaman Api & Penyelamatan Kabin',
    unit: 'Armada PKP-PK (Foam Tender 1 & 2)',
    pageNumber: 3,
    steps: [
      'Tiba di lokasi kecelakaan dalam waktu < 3 menit dari waktu kejadian, mengambil posisi Upwind (di atas arah datangnya angin).',
      'Mengoperasikan monitor atap/bumper untuk menembakkan lapisan busa kimia (foam blanket) menyelimuti kobaran api di sayap kanan dan tumpahan avtur.',
      'Melakukan pendinginan badan pesawat (skin fuselage cooling) menggunakan pancaran air kabut (fog) guna memperpanjang daya tahan hidup penumpang di dalam kabin (critical rescue time).',
    ],
  },
  {
    id: 'sop-8',
    phaseId: 'fase-4',
    phaseTitle: 'IV. Pemadaman Api & Penyelamatan Kabin',
    unit: 'Regu Rescue PKP-PK',
    pageNumber: 3,
    steps: [
      'Membawa tangga darurat dan perkakas penyelamat (forcible entry tools) menuju pintu darurat sisi kiri pesawat (sisi berlawanan dari kebakaran).',
      'Membuka pintu darurat kiri, menembus kabin berbekal breathing apparatus (SCBA), memandu penumpang yang sadar untuk keluar teratur.',
      'Melakukan evakuasi fisik korban cedera berat menggunakan tandu estafet menuju Collection Area (jarak 30–50 meter dari badan pesawat).',
    ],
  },
  {
    id: 'sop-9',
    phaseId: 'fase-4',
    phaseTitle: 'IV. Pemadaman Api & Penyelamatan Kabin',
    unit: 'Komando Lapangan (MCP & OSC)',
    pageNumber: 4,
    steps: [
      'Mobile Command Post (MCP) didirikan pada jarak ±120 meter (Upwind).',
      'Serah terima komando lapangan: Komandan Regu PKP-PK menyerahkan tongkat komando OSC kepada Ketua Tim TOKPD.',
      'OSC menginstruksikan Pengendali Staging Area: "Panggil 2 unit tangki Damkar Pemda untuk water relay ke Foam Tender PKP-PK, dan kirim seluruh tim medis ambulans menuju Triage dan Care Area!"',
    ],
  },
  {
    id: 'sop-10',
    phaseId: 'fase-4',
    phaseTitle: 'IV. Pemadaman Api & Penyelamatan Kabin',
    unit: 'Damkar Pemda & Petugas Staging',
    pageNumber: 4,
    steps: [
      'Mobil tangki Damkar Pemda bergerak dari Staging Area dengan panduan petugas AVSEC menuju posisi pengisian air (relay pumping).',
      'Menggelar selang penghubung suplai air tanpa memotong alur evakuasi tandu korban, memastikan pasokan air armada PKP-PK tidak terputus.',
    ],
  },
  {
    id: 'sop-11',
    phaseId: 'fase-6',
    phaseTitle: 'VI. Penutupan Operasi & Pemulihan Bandara',
    unit: 'Komandan PKP-PK',
    pageNumber: 5,
    steps: [
      'Melakukan penyisiran akhir kabin (overhaul inspection) dengan alat pengukur suhu inframerah untuk memastikan tidak ada titik api tersembunyi.',
      'Melaporkan kepada EOC: "Operasi pemadaman dan evakuasi selesai, kabin pesawat steril."',
      'Menarik seluruh armada ke Fire Station guna pengisian kembali air, konsentrat busa, tabung SCBA, dan bersiap kembali pada kesiapan operasional normal.',
    ],
  },
  {
    id: 'sop-12',
    phaseId: 'fase-6',
    phaseTitle: 'VI. Penutupan Operasi & Pemulihan Bandara',
    unit: 'Unit AVSEC & Kepolisian',
    pageNumber: 5,
    steps: [
      'Memasang garis batas pengamanan (security line) mengelilingi radius 50 meter di sekitar bangkai pesawat dan serpihan sayap di area kecelakaan.',
      'Menetapkan status quo pada lokasi insiden guna menjaga integritas bukti fisik untuk tim investigator Komite Nasional Keselamatan Transportasi (KNKT).',
      'Mengamankan kotak hitam (Flight Data Recorder / Cockpit Voice Recorder) dari intervensi pihak luar sebelum kedatangan investigator resmi.',
    ],
  },
  {
    id: 'sop-13',
    phaseId: 'fase-6',
    phaseTitle: 'VI. Penutupan Operasi & Pemulihan Bandara',
    unit: 'Manajemen UPBU & Maskapai (Salvage)',
    pageNumber: 6,
    steps: [
      'Setelah memperoleh izin tertulis (clearance) dari KNKT, maskapai Celebes Air bersama tim teknis UPBU memulai operasi pemindahan pesawat (aircraft removal/salvage).',
      'Berkoordinasi dengan pengelola Bandara Internasional Sultan Hasanuddin Makassar untuk pengerahan peralatan salvage (crane, trailer pengangkut, dan kantong udara pengangkat badan pesawat).',
    ],
  },
  {
    id: 'sop-14',
    phaseId: 'fase-6',
    phaseTitle: 'VI. Penutupan Operasi & Pemulihan Bandara',
    unit: 'Kepala Kantor UPBU Tanjung Api',
    pageNumber: 6,
    steps: [
      'Memerintahkan tim fasilitas sisi udara melakukan pembersihan menyeluruh serpihan logam/benda asing (Foreign Object Debris - FOD sweeping) dan inspeksi kerataan aspal Runway 12.',
      'Menyatakan landasan pacu aman dan laik terbang secara teknis.',
      'Menerbitkan NOTAM pembatalan penutupan bandara dan mengumumkan bahwa operasional penerbangan di Bandara Tanjung Api resmi dibuka kembali secara normal.',
    ],
  },
];

export const TACTICAL_ZONES: TacticalZone[] = [
  {
    name: 'Collection Area',
    distance: '30 – 50 meter',
    zoneLabel: 'Luar Hot Zone / Sisi Selamat',
    zoneLevel: 'hot',
    functionDesc:
      'Titik transit awal penerimaan korban yang berhasil dikeluarkan dari dalam pesawat atau serpihan kabin; mencegah terjadinya penumpukan di pintu darurat.',
    responsibleUnit:
      'Regu Penyelamat PKP-PK (Rescue Team) dibantu Tim Tandu Lapangan (Stretcher-Bearers).',
  },
  {
    name: 'Triage Area',
    distance: '50 – 90 meter',
    zoneLabel: 'Warm Zone (Arah Upwind)',
    zoneLevel: 'warm',
    functionDesc:
      'Pemeriksaan kilat (<60 detik per korban) untuk memilah dan melabeli tingkat kegawatdaruratan korban: Merah, Kuning, Hijau, dan Hitam.',
    responsibleUnit:
      'Dokter Triase KKP (Kantor Kesehatan Pelabuhan) didampingi tim paramedis gawat darurat RSUD dan Puskesmas.',
  },
  {
    name: 'Mobile Command Post (MCP)',
    distance: '100 – 150 meter',
    zoneLabel: 'Batas Warm / Cold Zone (Upwind)',
    zoneLevel: 'warm',
    functionDesc:
      'Pusat komando dan kendali taktis terpadu di lapangan; memfasilitasi komunikasi radio antar-instansi; koordinasi penugasan langsung oleh On Scene Commander (OSC).',
    responsibleUnit:
      'On Scene Commander (OSC / Ka Tim TOKPD), Operator Radio Komunikasi, didampingi Liaison Officer (LO) dari TNI, POLRI, Dishub, dan SAR.',
  },
  {
    name: 'Care Area',
    distance: '± 150 meter (± 500 kaki)',
    zoneLabel: 'Cold Zone (Akses Ambulans)',
    zoneLevel: 'cold',
    functionDesc:
      'Area perawatan medis lanjutan dan stabilisasi korban berdasarkan sektor warna tenda (Merah/Kuning/Hijau) sebelum dirujuk via ambulans, serta sektor Hitam (pos DVI/kamar jenazah sementara tertutup dari publik).',
    responsibleUnit:
      'Tim Dokter Spesialis & Perawat Trauma (RSUD Ampana, Dinkes, PMI), Konselor Psikososial, serta Tim Inafis/DVI Polres Tojo Una-Una.',
  },
];

export const TRIAGE_CATEGORIES: TriageCategory[] = [
  {
    id: 'red',
    label: 'Kategori Merah',
    count: 6,
    severity: 'Kritis (Immediate)',
    actions: [
      'Korban mengalami cedera kepala terbuka, luka bakar jalan napas, dan syok hemoragik.',
      'Diberikan intubasi/bantuan oksigen murni, pembidaian fraktur terbuka, dan infus cairan di Tenda Merah Care Area.',
      'Langsung dinaikkan ke ambulans gawat darurat (1 korban per ambulans) dan dievakuasi ke IGD RSUD Ampana dengan pengawalan prioritas sirene penuh Satlantas Polres.',
    ],
  },
  {
    id: 'yellow',
    label: 'Kategori Kuning',
    count: 8,
    severity: 'Cedera Sedang (Delayed)',
    actions: [
      'Korban mengalami patah tulang tertutup pada ekstremitas dan luka laserasi luas tanpa gangguan sirkulasi napas.',
      'Dilakukan stabilisasi bidai (splinting), pembalutan steril, dan pemberian analgesik di Tenda Kuning Care Area.',
      'Dievakuasi secara bertahap menggunakan ambulans transport cadangan menuju RSUD Ampana dan Puskesmas Ampana Timur.',
    ],
  },
  {
    id: 'green',
    label: 'Kategori Hijau',
    count: 38,
    severity: 'Luka Ringan (Minor)',
    actions: [
      'Penumpang selamat dengan luka lecet ringan atau syok emosional/histeria.',
      'Diberikan perawatan pertolongan pertama (P3K) dan konsumsi cairan di Tenda Hijau Care Area.',
      'Dipindahkan secara terorganisir menggunakan bus operasional bandara menuju Passenger Holding Area di gedung terminal untuk pencocokan manifes dan pendampingan keluarga oleh maskapai Celebes Air.',
    ],
  },
  {
    id: 'black',
    label: 'Kategori Hitam',
    count: 2,
    severity: 'Meninggal Dunia (Expectant)',
    actions: [
      'Korban henti napas/jantung tanpa respons tanda vital di tempat kejadian.',
      'Dimasukkan ke dalam kantong jenazah dan ditempatkan di Tenda Hitam (posko tertutup dari jangkauan pandangan penumpang dan keluarga).',
      'Tim Inafis / DVI Polres Tojo Una-Una melaksanakan tindakan identifikasi primer, pemotretan, dan olah TKP di lokasi sebelum jenazah dievakuasi ke kamar mayat RSUD.',
    ],
  },
];
