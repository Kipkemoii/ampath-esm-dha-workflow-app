import React, { useState } from 'react';
import { type PatientBill } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';

import styles from './bills-table.scss';

interface BillsTableProps {
  patients: PatientBill[];
  onPatientClick?: (patientUuid: string) => void;
}

const BillsTable: React.FC<BillsTableProps> = ({ patients, onPatientClick }) => {
  const [patientUuid, setPatientUuid] = useState<string | null>('');
  const [visitUuid, setVisitUuid] = useState<string | null>('');
  const [visitTypeUuid, setVisitTypeUuid] = useState('');
  const formatDate = (date?: string | null) => {
    if (!date) return '—';

    return new Intl.DateTimeFormat('en-KE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(date));
  };
  const handleInitiateClaim = (patientUuid: string, visitTypeUuid: string, visitUuid: string) => {
    setPatientUuid(patientUuid);
    setVisitTypeUuid(visitTypeUuid);
    setVisitUuid(visitUuid);
  };

  function onModalClose({ success }: { success: boolean }): void {
    setPatientUuid(null);
    setVisitUuid(null);
  }
  return (
    <>
      <Table aria-label="sample table" size="lg">
        <TableHead>
          <TableRow>
            <TableHeader>Name</TableHeader>
            <TableHeader>Cr Identifier</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Receipt Number</TableHeader>
            <TableHeader>Bill Date</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {patients.map((patient) => {
            const canOpen = Boolean(patient.patient_uuid || patient.consent_token);
            return (
              <TableRow key={patient.patient_uuid}>
                <TableCell>
                  {canOpen ? (
                    <button
                      type="button"
                      className={styles.clickableData}
                      onClick={() => onPatientClick?.(patient.patient_uuid)}
                    >
                      {patient.patient_name}
                    </button>
                  ) : (
                    patient.patient_name
                  )}
                </TableCell>
                <TableCell>{patient.identifier}</TableCell>
                <TableCell>{patient.bill_status}</TableCell>
                <TableCell>{patient.receipt_number}</TableCell>
                <TableCell>{formatDate(patient.bill_date)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
};

export default BillsTable;
