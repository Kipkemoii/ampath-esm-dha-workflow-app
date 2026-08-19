import React, { useEffect, useState } from 'react';
import { Loading, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { fetchClaimsDashboardPatientChart } from '../../billing-claims.resource';
import { type ClaimPatientList } from './types';

interface BillingAndClaimsPatientChartProps {
  indicator: string;
  startDate: string;
  endDate: string;
  locationUuid: string;
}
const BillingAndClaimsPatientChart: React.FC<BillingAndClaimsPatientChartProps> = ({
  indicator,
  startDate,
  endDate,
  locationUuid,
}) => {
  const [patientList, setPatientList] = useState<ClaimPatientList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const getClaimsDashboardPatientChart = async () => {
    setIsLoading(true);
    const res = await fetchClaimsDashboardPatientChart(indicator, startDate, endDate, locationUuid);
    setPatientList(res);
    setIsLoading(false);
  };

  useEffect(() => {
    getClaimsDashboardPatientChart();
  }, [indicator]);
  return (
    <>
      {isLoading && <Loading />}
      <Table aria-label="table" size="lg">
        <TableHead>
          <TableRow>
            <TableHeader>#</TableHeader>
            <TableHeader>Name</TableHeader>
            <TableHeader>Age</TableHeader>
            <TableHeader>Gender</TableHeader>
            <TableHeader>County/Subcounty</TableHeader>
            <TableHeader>Phone</TableHeader>
            <TableHeader>Diagnosis</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {patientList &&
            patientList.length &&
            patientList.map((p, i) => {
              return (
                <TableRow>
                  <TableCell>{i}</TableCell>
                  <TableCell>{p.patient_name}</TableCell>
                  <TableCell>{p.age}</TableCell>
                  <TableCell>{p.gender}</TableCell>
                  <TableCell>{p.county_sub_county}</TableCell>
                  <TableCell>{p.phone_number}</TableCell>
                  <TableCell>{p.diagnosis}</TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </>
  );
};

export default BillingAndClaimsPatientChart;
