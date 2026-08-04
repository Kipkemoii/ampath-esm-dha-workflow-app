import React from 'react';
import { type ClaimVisitReponse } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';

interface SHAClaimsTableProps {
  claimVisits: ClaimVisitReponse[];
}

const SHAClaimsTable: React.FC<SHAClaimsTableProps> = () => {
  return (
    <>
      <Table aria-label="sha claims" size="lg">
        <TableHead>
          <TableRow>
            <TableHeader>Patient</TableHeader>
            <TableHeader>CR Number</TableHeader>
            <TableHeader>Visit Tyoe</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Date</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Load Balancer 1</TableCell>
            <TableCell>Round robin</TableCell>
            <TableCell>Starting</TableCell>
            <TableCell>Test</TableCell>
            <TableCell>22</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </>
  );
};

export default SHAClaimsTable;
