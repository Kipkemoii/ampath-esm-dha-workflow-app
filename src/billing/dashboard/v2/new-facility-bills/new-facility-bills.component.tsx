import React, { useEffect, useState } from 'react';
import { type FacilityBillsDto, type PatientBill } from '../types';
import { fetchFacilityBills } from '../../../billing-claims.resource';
import { showSnackbar } from '@openmrs/esm-framework';
import { useNavigate } from 'react-router-dom';
import BillsTable from './bills-table.component';
import { DataTableSkeleton } from '@carbon/react';

import styles from './new-facility-bills.scss';

interface NewFacilityBillsProps {
  billingDate: string;
  locationUuid: string;
  onDateChange?: (date: string) => void;
}
const NewFacilityBills: React.FC<NewFacilityBillsProps> = ({ billingDate, locationUuid }) => {
  const navigate = useNavigate();
  const [facilityBills, setFacilityBills] = useState<PatientBill[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const handlePatientClick = (patientUuid: string) => {
    if (!patientUuid) return;
    navigate(`/bill/${encodeURIComponent(patientUuid)}`);
  };

  useEffect(() => {
    if (locationUuid && billingDate) {
      getFacilityBills();
    }
  }, [billingDate, locationUuid]);

  async function getFacilityBills() {
    setLoading(true);
    const facilityBillsPayload = generateFacilityBillsPayload();
    try {
      const data = await fetchFacilityBills(facilityBillsPayload);

      setFacilityBills(data ?? []);
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error fetching facility bills',
        subtitle: 'An error occurred while fetching facility bills, please reload or contact support',
      });
    } finally {
      setLoading(false);
    }
  }
  function generateFacilityBillsPayload(): FacilityBillsDto {
    return {
      locationUuid: locationUuid ?? '',
      billingDate: billingDate,
    };
  }

  return (
    <>
      {loading && <DataTableSkeleton columnCount={6} rowCount={5} />}
      <BillsTable patients={facilityBills} onPatientClick={handlePatientClick} />
    </>
  );
};

export default NewFacilityBills;
