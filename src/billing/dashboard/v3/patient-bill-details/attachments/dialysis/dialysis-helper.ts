export interface ClinicalNoteField {
  label: string;
  value: string;
}

export interface ClinicalNote {
  encounterUuid: string;
  encounterType: string;
  datetime: string;
  fields: ClinicalNoteField[];
}

const getFieldValue = (fields: ClinicalNoteField[] = [], labelMatch: string): string | undefined =>
  fields.find((f) => f.label?.toUpperCase().includes(labelMatch.toUpperCase()))?.value;

const findLatestNote = (notes: ClinicalNote[], encounterType: string): ClinicalNote | undefined =>
  notes.find((n) => n.encounterType === encounterType);

// Every note of a given type, oldest first — so the monitoring table reads
// 0 min, 60 min, 120 min… in the order the session actually happened.
const findAllNotesAsc = (notes: ClinicalNote[], encounterType: string): ClinicalNote[] =>
  notes
    .filter((n) => n.encounterType === encounterType)
    .slice()
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

export interface ExtractedDialysisData {
  preAssessment: {
    accessType: string;
    notes: string;
  };
  monitoring: Array<{
    time: string;
    ufRemoved: string;
    heparin: string;
    remarks: string;
  }>;
  postAssessment: {
    totalUfAchieved: string;
    accessSite: string;
    condition: string;
    complications: string;
    temperature: string;
    venousPressure: string;
    arterialPressure: string;
  };
}

export function extractDialysisData(clinicalNotes: ClinicalNote[] = []): ExtractedDialysisData {
  // --- Pre-Dialysis Assessment: DOCTORNOTES ---
  const doctorNote = findLatestNote(clinicalNotes, 'DOCTORNOTES');
  const preAssessment = {
    // No dedicated "access type" field exists under DOCTORNOTES in this payload —
    // falls back to '—' until confirmed where pre-dialysis access type is recorded.
    accessType: getFieldValue(doctorNote?.fields, 'ACCESS') ?? '—',
    notes: getFieldValue(doctorNote?.fields, 'THERAPEUTIC PLAN NOTES') ?? '—',
  };

  // --- Intra-Dialytic Monitoring: INTRADIALYTIC, one row per encounter ---
  const intradialyticNotes = findAllNotesAsc(clinicalNotes, 'INTRADIALYTIC');
  const monitoring = intradialyticNotes.map((note) => {
    const minutes = getFieldValue(note.fields, 'NUMBER OF MINUTES');
    const uf = getFieldValue(note.fields, 'UF ULTRAFILTRATION VOLUME');
    const heparin = getFieldValue(note.fields, 'HEPARIN DOSE ADMINISTERED');
    const remarks = getFieldValue(note.fields, 'THERAPEUTIC PLAN NOTES');
    return {
      time: minutes ? `${minutes} min` : '—',
      ufRemoved: uf ? `${uf}mls` : '—',
      heparin: heparin ? `${heparin}iu` : '—',
      remarks: remarks ?? '—',
    };
  });

  // --- Post-Dialysis Assessment: HEMODIALYSIS ---
  const hemoNote = findLatestNote(clinicalNotes, 'HEMODIALYSIS');
  const postAssessment = {
    totalUfAchieved: getFieldValue(hemoNote?.fields, 'TOTAL UF VOLUME') ?? '—',
    accessSite: getFieldValue(hemoNote?.fields, 'TYPE OF DIALYSIS ACCESS') ?? '—',
    condition:
      getFieldValue(hemoNote?.fields, 'POST DIALYSIS REMARKS') ??
      getFieldValue(hemoNote?.fields, 'INTERVENTION') ??
      '—',
    temperature: getFieldValue(hemoNote?.fields, 'DIALYSATE TEMPERATURE'),
    venousPressure: getFieldValue(hemoNote?.fields, 'VENOUS PRESSURE'),
    arterialPressure: getFieldValue(hemoNote?.fields, 'ARTERIAL PRESSURE'),
    // No "complications" label appears anywhere in this sample payload —
    // defaults to 'None' rather than silently fabricating a value.
    complications: getFieldValue(hemoNote?.fields, 'COMPLICATION') ?? 'None',
  };

  const summary = {};

  return { preAssessment, monitoring, postAssessment };
}
