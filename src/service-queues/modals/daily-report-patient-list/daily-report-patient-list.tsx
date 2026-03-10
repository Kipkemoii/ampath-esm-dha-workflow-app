import React from 'react';
import { Modal, ModalBody, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import styles from './daily-report-patient-list.scss';
import { type ServiceQueueReportPatientList } from '../../../shared/types';

interface DailyReportPatientListModalProps {
  open: boolean;
  onModalClose: () => void;
  patientList: ServiceQueueReportPatientList[];
}

const DailyReportPatientListModal: React.FC<DailyReportPatientListModalProps> = ({
  open,
  onModalClose,
  patientList,
}) => {
  return (
    <>
      <Modal
        modalHeading="Checked In Patient List"
        open={open}
        size="lg"
        onSecondarySubmit={() => onModalClose()}
        onRequestClose={() => onModalClose()}
        onRequestSubmit={onModalClose}
        primaryButtonText="Close"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.serveModalLayout}>
            <div className={styles.serveModalContentSection}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>No</TableHeader>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Age</TableHeader>
                    <TableHeader>Gender</TableHeader>
                    <TableHeader>Phone Number</TableHeader>
                    <TableHeader>Identifiers</TableHeader>
                    <TableHeader>Queue Room</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patientList.map((val, index) => (
                    <TableRow id={`${val.queue_entry_id}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{val.person_name}</TableCell>
                      <TableCell>{val.age}</TableCell>
                      <TableCell>{val.gender}</TableCell>
                      <TableCell>{val.phone_number}</TableCell>
                      <TableCell>{val.identifiers}</TableCell>
                      <TableCell>{val.queue_room_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default DailyReportPatientListModal;
