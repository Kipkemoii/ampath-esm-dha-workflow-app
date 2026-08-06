import React, { useEffect, useMemo, useState } from 'react';
import {
  Link,
  OverflowMenu,
  OverflowMenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import {
  type BillStatus,
  type FacilityEncounterBill,
  type BedLayout,
  type AwaitingDischargePatientList,
} from '../types';
import DischargeModal from '../modal/discharge/discharge-patient.modal';
import { fetchPatientsAwaitingDischarge } from '../admissions.resource';
import { type FacilityBill } from '../../billing/dashboard/v3/types';
import AddBillItemsModal from '../modal/add-bill-items/add-bill-items.modal';

interface AwaitingDischargeListProps {
  locationUuid: string;
  facilityBills: FacilityEncounterBill[];
  refresh: () => void;
}

const AwaitingDischargeList: React.FC<AwaitingDischargeListProps> = ({ locationUuid, facilityBills, refresh }) => {
  const [showDischargeModal, setShowDischargeModal] = useState<boolean>(false);
  const [selectedDischargePatient, setSelectedDischargePatient] = useState<AwaitingDischargePatientList & {}>();
  const [awaitingDischargePatientList, setAwaitingDischargePatientList] = useState<AwaitingDischargePatientList[]>([]);
  const [showAddBillItemsModal, setShowBillItemsModal] = useState<boolean>(false);
  useEffect(() => {
    getPatientsAwaitingDischarge();
  }, []);
  const rows = useMemo(() => {
    return awaitingDischargePatientList?.map((p) => {
      return {
        ...p,
        billStatus:
          getBillStatus(facilityBills.find((fB) => fB.patient_uuid === p?.person_uuid)?.bill_status) ?? 'PENDING',
      };
    });
  }, [awaitingDischargePatientList, facilityBills]);
  if (!locationUuid) {
    return <>No data to display</>;
  }
  const handleDischargeRequest = (dischargePatient: AwaitingDischargePatientList) => {
    setSelectedDischargePatient(dischargePatient);
    setShowDischargeModal(true);
  };
  const handleDischargeModalClose = () => {
    setShowDischargeModal(false);
  };
  const handleSuccessfullDischarge = () => {
    refresh();
  };
  function getBillStatus(billStatus: string): BillStatus {
    if (!billStatus) {
      return 'NOT_BILLED';
    }
    if (billStatus.toUpperCase().trim() === 'PAID') {
      return 'PAID';
    }
    if (billStatus.toUpperCase().trim() === 'PENDING') {
      return 'PENDING';
    }
  }

  if (!rows.length) {
    return <>No Data</>;
  }

  async function getPatientsAwaitingDischarge() {
    const resp = await fetchPatientsAwaitingDischarge(locationUuid);
    if (resp) {
      setAwaitingDischargePatientList(resp);
    }
  }

  function handleAddBillItems(data: any) {
    setSelectedDischargePatient(data);
    setShowBillItemsModal(true);
  }
  function handleSuccessFullAddBillItems() {
    setShowBillItemsModal(false);
  }
  function handleAddBillItemsClose() {
    setShowBillItemsModal(false);
  }

  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>No</TableHeader>
            <TableHeader>Bed No</TableHeader>
            <TableHeader>Patient Name</TableHeader>
            <TableHeader>Gender</TableHeader>
            <TableHeader>Age</TableHeader>
            <TableHeader>Identifier</TableHeader>
            <TableHeader>Bill Status</TableHeader>
            <TableHeader>Location</TableHeader>
            <TableHeader>Action</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.bed_id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell></TableCell>
              <TableCell>
                {row.person_uuid ? (
                  <Link href={`${window.spaBase}/patient/${row.person_uuid}/chart/`}>{row.patient_name}</Link>
                ) : (
                  row.patient_name
                )}
              </TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell>
                {row.cr_id} {row.national_id}
              </TableCell>
              <TableCell>
                <BillStatusTag status={row.billStatus} />
              </TableCell>
              <TableCell>{row.location}</TableCell>
              <TableCell>
                <>
                  {row.billStatus === 'PAID' ? (
                    <OverflowMenu aria-label="overflow-menu">
                      <OverflowMenuItem itemText="Discharge" onClick={() => handleDischargeRequest(row as any)} />
                    </OverflowMenu>
                  ) : (
                    <>
                      <OverflowMenu aria-label="overflow-menu">
                        <OverflowMenuItem itemText="Discharge" onClick={() => handleDischargeRequest(row as any)} />
                        <OverflowMenuItem itemText="Add Bill Items" onClick={() => handleAddBillItems(row as any)} />
                      </OverflowMenu>
                    </>
                  )}
                </>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {showAddBillItemsModal && selectedDischargePatient ? (
        <>
          <AddBillItemsModal
            crId={selectedDischargePatient.cr_id ?? ''}
            patientUuid={selectedDischargePatient.person_uuid}
            onModalClose={handleAddBillItemsClose}
            onAddBillItems={handleSuccessFullAddBillItems}
            open={showAddBillItemsModal}
          />
        </>
      ) : (
        <></>
      )}
      {showDischargeModal && selectedDischargePatient ? (
        <>
          <DischargeModal
            open={showDischargeModal}
            onModalClose={handleDischargeModalClose}
            onDischarge={handleSuccessfullDischarge}
            patientUuid={selectedDischargePatient.person_uuid}
            locationUuid={selectedDischargePatient.location_uuid}
            bedId={selectedDischargePatient.bed_id}
          />
        </>
      ) : (
        <></>
      )}
    </>
  );
};

type CarbonTagColor = 'red' | 'green' | 'gray' | 'blue' | 'cyan' | 'purple' | 'magenta' | 'teal';

const BILL_STATUS_CONFIG: Record<BillStatus, { color: CarbonTagColor; label: string }> = {
  PAID: { color: 'green', label: 'Paid' },
  PENDING: { color: 'red', label: 'Pending' },
  NOT_BILLED: { color: 'blue', label: 'Not billed' },
};

function BillStatusTag({ status }: { status: BillStatus }) {
  const config = BILL_STATUS_CONFIG[status] ?? BILL_STATUS_CONFIG.NOT_BILLED;
  return <Tag type={config.color}>{config.label}</Tag>;
}

export default AwaitingDischargeList;
