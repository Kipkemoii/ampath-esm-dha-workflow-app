import React from 'react';
import { type QueueEntryResult } from '../../registry/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { isDesktop, useLayoutType } from '@openmrs/esm-framework';

interface PatientListProps {
  patients?: QueueEntryResult[];
}

const PatientList: React.FC<PatientListProps> = ({ patients }) => {
  const layout = useLayoutType();
  const desktop = isDesktop(layout);
  return (
    <Table size={desktop ? 'sm' : 'lg'}>
      <TableHead>
        <TableRow>
          <TableHeader>No</TableHeader>
          <TableHeader>Name</TableHeader>
          <TableHeader>Ticket</TableHeader>
          <TableHeader>Status</TableHeader>
          <TableHeader>Priority</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {patients?.map((patient, index) => {
          return (
            <TableRow>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{`${patient.given_name} ${patient.middle_name} ${patient.family_name}`}</TableCell>
              <TableCell>{patient.queue_id}</TableCell>
              <TableCell>{patient.status}</TableCell>
              <TableCell>{patient.priority}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default PatientList;
