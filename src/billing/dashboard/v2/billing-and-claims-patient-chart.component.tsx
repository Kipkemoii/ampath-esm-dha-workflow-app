import React  from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { type ClaimVisit } from '../../types';
import { formatDate } from '@openmrs/esm-framework';

interface BillingAndClaimsPatientChartProps {
  claimVisits: ClaimVisit[];
}
const BillingAndClaimsPatientChart: React.FC<BillingAndClaimsPatientChartProps> = ({claimVisits}) => {

  if(!claimVisits || claimVisits.length === 0){
     return <>No Data to display</>
  }


  return (
    <>
      <Table aria-label="table" size="lg">
        <TableHead>
          <TableRow>
            <TableHeader>#</TableHeader>
            <TableHeader>CR</TableHeader>
            <TableHeader>Visit Start</TableHeader>
            <TableHeader>Service Type</TableHeader>
            <TableHeader>Provider Status</TableHeader>
            <TableHeader>Payer Status</TableHeader>
            <TableHeader>Total Claim Amount</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {claimVisits &&
            claimVisits.length &&
            claimVisits.map((v, i) => {
              return (
                <TableRow key={v.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{v.patientId}</TableCell>
                  <TableCell>{v.visitStart}</TableCell>
                  <TableCell>{v.serviceType}</TableCell>
                  <TableCell>{v.providerStatus}</TableCell>
                  <TableCell>{v.payerStatus}</TableCell>
                  <TableCell>{v.totalClaimAmount}</TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </>
  );
};

export default BillingAndClaimsPatientChart;
