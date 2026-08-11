import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { closeWorkspace, launchWorkspace, useSession } from '@openmrs/esm-framework';
import React, { useEffect, useState } from 'react';
import { type PendingBillLineItems, type ActiveCashVisit } from '../types';
import { getActiveCashVisits, getFacilityBillLineItems } from '../../../billing-claims.resource';
import SendToQueueModal from '../../../../registry/modal/send-to-triage/send-to-queue.modal';
import styles from './cash-patients.scss';

interface CashPatientsProps {
  billingDate: string;
}

const CashPatients: React.FC<CashPatientsProps> = ({ billingDate }) => {
  const [cashPatients, setCashPatients] = useState<ActiveCashVisit[]>([]);
  const [pendingBillItems, setPendingBillItems] = useState<PendingBillLineItems[]>([]);
  const [patientUuid, setPatientUuid] = useState<string | null>('');
  const [visitUuid, setVisitUuid] = useState<string | null>('');
  const [visitTypeUuid, setVisitTypeUuid] = useState('');

  const session = useSession();

  const locationUuid = session.sessionLocation?.uuid;

  const fetchAll = async () => {
    if (!locationUuid) return;
    try {
      const [visitsRes, pendingRes] = await Promise.all([
        getActiveCashVisits(locationUuid, billingDate),
        getFacilityBillLineItems(locationUuid, billingDate),
      ]);
      setCashPatients(visitsRes?.results ?? []);
      setPendingBillItems(pendingRes ?? []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [billingDate, locationUuid]);

  const mergedPatients: (ActiveCashVisit | PendingBillLineItems)[] = (() => {
    const pendingByVisitUuid = new Map(pendingBillItems.map((item) => [item.visit_uuid, item]));

    const result: (ActiveCashVisit | PendingBillLineItems)[] = [...pendingBillItems];

    cashPatients.forEach((visit) => {
      if (!pendingByVisitUuid.has(visit.visit_uuid)) {
        result.push(visit);
      }
    });

    return result;
  })();

  const handleGenerateBill = async (
    visit: ActiveCashVisit | PendingBillLineItems,
    patientUuid: string,
    visitTypeUuid: string,
    visitUuid: string,
    billUuid: string,
    cashModeUuid: string,
  ) => {
    if ('line_item_date' in visit) {
      launchWorkspace('pay-cash-workspace', {
        lineItems: (visit as PendingBillLineItems).pending_line_items,
        billUuid: billUuid,
        cashModeUuid: cashModeUuid,
        onPaymentSuccess: fetchAll,
      });
      return;
    }
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
      <div className={styles.tableContainer}>
        <Table aria-label="sample table" size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Identifiers</TableHeader>
              <TableHeader>Payment Method</TableHeader>
              <TableHeader>Visit Type</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {mergedPatients?.length > 0 ? (
              mergedPatients?.map((visit, index) => (
                <TableRow key={index}>
                  <TableCell>{visit.patient_name}</TableCell>
                  <TableCell>{visit.identifiers}</TableCell>
                  <TableCell>{visit.payment_method}</TableCell>
                  <TableCell>{visit.visit_type}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      kind="primary"
                      onClick={() =>
                        handleGenerateBill(
                          visit,
                          visit.patient_uuid,
                          visit.visit_type_uuid,
                          visit.visit_uuid,
                          visit.bill_uuid,
                          visit.cash_mode_uuid,
                        )
                      }
                    >
                      Open Billing
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5}>No Patients found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {patientUuid && visitUuid && (
        <SendToQueueModal
          patientUuid={patientUuid}
          visitUuid={visitUuid}
          visitTypeUuid={visitTypeUuid}
          onModalClose={onModalClose}
          isCash={true}
        />
      )}
    </>
  );
};

export default CashPatients;
