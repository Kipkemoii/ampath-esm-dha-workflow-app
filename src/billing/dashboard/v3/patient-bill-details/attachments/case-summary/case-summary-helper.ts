import { type PatientVitals, type VitalReading } from '../type';

export const normalizeVitals = (vitals?: PatientVitals): VitalReading[] => [
  {
    label: 'Temp',
    value: vitals?.temperature ?? '—',
    unit: '°C',
    trend: 'flat',
  },
  {
    label: 'Pulse',
    value: vitals?.pulse ?? '—',
    unit: 'bpm',
    trend: 'flat',
  },
  {
    label: 'BP',
    value: vitals?.bloodPressure ?? '—',
    unit: 'mmHg',
    trend: 'flat',
  },
  {
    label: 'RR',
    value: vitals?.respiratoryRate ?? '—',
    unit: '/min',
    trend: 'flat',
  },
  {
    label: 'SpO₂',
    value: vitals?.spo2 ?? '—',
    unit: '%',
    trend: 'flat',
  },
  {
    label: 'Wt',
    value: vitals?.weight ?? '—',
    unit: 'kg',
    trend: 'flat',
  },
  {
    label: 'Ht',
    value: vitals?.height ?? '—',
    unit: 'cm',
    trend: 'flat',
  },
  {
    label: 'BMI',
    value: vitals?.bmi ?? '—',
    unit: '',
    trend: 'flat',
  },
  {
    label: 'TEW',
    value: vitals?.tewScore ?? '—',
    unit: '',
    trend: 'flat',
  },
];
