import {
  Button,
  Link,
  OverflowMenu,
  OverflowMenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { type QueueEntryResult } from '../../registry/types';
import React, { useState } from 'react';
import styles from './queue-list.component.scss';

interface QueueListProps {
  queueEntries: QueueEntryResult[];
  handleMovePatient: (queueEntryResult: QueueEntryResult) => void;
  handleTransitionPatient: (queueEntryResult: QueueEntryResult) => void;
  handleServePatient: (queueEntryResult: QueueEntryResult) => void;
}

const QueueList: React.FC<QueueListProps> = ({
  queueEntries,
  handleMovePatient,
  handleTransitionPatient,
  handleServePatient,
}) => {
  const [checkIn, setCheckIn] = useState<boolean>(false);
  const handleCheckin = () => {
    setCheckIn((prev) => !prev);
  };
  return (
    <>
      <div className={styles.queueListLayout}>
        <div className={styles.actionHeader}>
          {checkIn ? (
            <>
              <Button kind="danger" onClick={handleCheckin}>
                {' '}
                Check Out
              </Button>
            </>
          ) : (
            <>
              <Button kind="primary" onClick={handleCheckin}>
                {' '}
                Check In
              </Button>
            </>
          )}
        </div>
        <div className={styles.tableSection}>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>No</TableHeader>
                <TableHeader>Name</TableHeader>
                <TableHeader>Ticket</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Priority</TableHeader>
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {queueEntries.map((val, index) => (
                <TableRow>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    {checkIn ? (
                      <Link href={`${window.spaBase}/patient/${val.patient_uuid}/chart/`}>
                        {val.family_name} {val.middle_name}
                      </Link>
                    ) : (
                      <>
                        {val.family_name} {val.middle_name}
                      </>
                    )}
                  </TableCell>
                  <TableCell>{val.queue_entry_id}</TableCell>
                  <TableCell>{val.status}</TableCell>
                  <TableCell>{val.priority}</TableCell>
                  <TableCell>
                    {val.status === 'WAITING' ? (
                      <>
                        <Button kind="ghost" disabled={!checkIn} onClick={() => handleServePatient(val)}>
                          Serve
                        </Button>
                      </>
                    ) : (
                      <>
                        {checkIn ? (
                          <>
                            <OverflowMenu aria-label="overflow-menu">
                              <OverflowMenuItem itemText="Move" onClick={() => handleMovePatient(val)} />
                              <OverflowMenuItem itemText="Transition" onClick={() => handleTransitionPatient(val)} />
                              <OverflowMenuItem itemText="Sign off" onClick={handleCheckin} />
                              <OverflowMenuItem itemText="Remove Patient" />
                            </OverflowMenu>
                          </>
                        ) : (
                          <></>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
};

export default QueueList;
