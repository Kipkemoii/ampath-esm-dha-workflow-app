import React, { useEffect } from 'react';
import { useState } from 'react';
import { type FacilityBillsDto, type FacilityBill, BillingView } from '../types';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import { fetchFacilityBills } from '../../../billing-claims.resource';
import styles from './facility-bills.component.scss';
import PatientBillDetails from '../patient-bill-details/patient-bill-details';
import TableToolbar from '../shared/table-toolbar.component';
import EmptyState from '../shared/empty-state.component';
import { type PatientBill } from '../../v2/types';

interface facilityBillsProps {
  billingDate: string;
  locationUuid: string;
  onDateChange?: (value: string) => void;
}
const FacilityBillsV3: React.FC<facilityBillsProps> = ({ billingDate, locationUuid, onDateChange }) => {
  const [facilityBills, setFacilityBills] = useState<PatientBill[]>([]);
  const [currentView, setCurrentView] = useState<BillingView>(BillingView.Bills);
  const [selectedPatientUuid, setSelectedPatientUuid] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  useEffect(() => {
    if (locationUuid && billingDate) {
      getFacilityBills();
    }
  }, [billingDate, locationUuid]);
  async function getFacilityBills() {
    const facilityBillsPayload = generateFacilityBillsPayload();
    try {
      const data = await fetchFacilityBills(facilityBillsPayload);
      if (data) {
        setFacilityBills(data);
      } else {
        setFacilityBills([]);
      }
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error fetching facility bills',
        subtitle: 'An error occurred while fetehcing facility bills, please reload or contact support',
      });
    }
  }
  function generateFacilityBillsPayload(): FacilityBillsDto {
    return {
      locationUuid: locationUuid ?? '',
      billingDate: billingDate,
    };
  }

  function toggleView(newView: BillingView, patientUuid: string) {
    setCurrentView(newView);
    setSelectedPatientUuid(patientUuid);
  }
  function formatStatusColumn(status: string | null | undefined) {
    if (status == null || status === '') {
      return '—';
    }
    const statusArr = String(status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (statusArr.length > 0) {
      const hasPostedBill = statusArr.some((s) => {
        return s === 'POSTED';
      });
      if (hasPostedBill) {
        return 'PARTIALLY PAID';
      }
      const hasPendingBill = statusArr.some((s) => s === 'PENDING');
      if (hasPendingBill) {
        return 'PENDING';
      }

      return 'PAID';
    }
    return String(status);
  }

  const formatDate = (date?: string | null) => {
    if (!date) return '—';

    return new Intl.DateTimeFormat('en-KE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date));
  };

  return (
    <>
      <TableToolbar
        id="facility-bills"
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search patient, status or cash point…"
        onDate={onDateChange}
      />
      {currentView === BillingView.Bills ? (
        (facilityBills ?? []).length === 0 ? (
          <EmptyState message="No bills." />
        ) : (
          <>
            {facilityBills.length === 0 ? (
              <EmptyState message="No bills match your search." />
            ) : (
              <Table aria-label="facility bills" size="sm">
                <TableHead>
                  <TableRow>
                    <TableHeader>No</TableHeader>
                    <TableHeader>Date</TableHeader>
                    <TableHeader>Patient</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Identifier</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {facilityBills.map((fb, index) => {
                    return (
                      <TableRow key={fb.patient_uuid}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{formatDate(fb.visit_start_date)}</TableCell>
                        <TableCell>
                          <div
                            className={styles.clickableData}
                            onClick={() => toggleView(BillingView.BillDetails, fb.patient_uuid)}
                          >
                            {fb.patient_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const s = formatStatusColumn(fb.paid_status);
                            const type = s === 'PAID' ? 'green' : s === 'PENDING' ? 'gray' : 'blue';
                            return (
                              <Tag size="sm" type={type}>
                                {s}
                              </Tag>
                            );
                          })()}
                        </TableCell>
                        <TableCell>{fb.cr_id}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </>
        )
      ) : (
        <></>
      )}
      {currentView === BillingView.BillDetails && selectedPatientUuid ? (
        <>
          <div>
            <Button kind="primary" onClick={() => toggleView(BillingView.Bills, '')}>
              Back
            </Button>
          </div>
          <div>
            <PatientBillDetails
              locationUuid={locationUuid}
              billingDate={billingDate}
              patientUuid={selectedPatientUuid}
            />
          </div>
        </>
      ) : (
        <></>
      )}
    </>
  );
};

export default FacilityBillsV3;
