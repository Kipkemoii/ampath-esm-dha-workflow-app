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
  Tag,
} from '@carbon/react';
import { type QueueEntryResult } from '../../registry/types';
import React, { useState } from 'react';
import styles from './queue-list.component.scss';
import { QueueEntryPriority, QueueEntryStatus, type TagColor } from '../../types/types';

interface QueueListProps {
  queueEntries: QueueEntryResult[];
  handleMovePatient: (queueEntryResult: QueueEntryResult) => void;
  handleTransitionPatient: (queueEntryResult: QueueEntryResult) => void;
  handleServePatient: (queueEntryResult: QueueEntryResult) => void;
  handleSignOff: (queueEntryResult: QueueEntryResult) => void;
}

const QueueList: React.FC<QueueListProps> = ({
  queueEntries,
  handleMovePatient,
  handleTransitionPatient,
  handleServePatient,
  handleSignOff,
}) => {
  const [checkIn, setCheckIn] = useState<boolean>(false);
  const handleCheckin = () => {
    setCheckIn((prev) => !prev);
  };
  const getTagTypeByStatus = (status: string): TagColor => {
    let type: TagColor;
    switch (status) {
      case QueueEntryStatus.Completed:
        type = 'green';
        break;
      case QueueEntryStatus.Waiting:
        type = 'gray';
        break;
      case QueueEntryStatus.InService:
        type = 'blue';
        break;
      default:
        type = 'gray';
    }
    return type;
  };
  const getTagTypeByPriority = (priority: string): TagColor => {
    let type: TagColor;
    switch (priority) {
      case QueueEntryPriority.Emergency:
        type = 'red';
        break;
      case QueueEntryPriority.Normal:
        type = 'blue';
        break;
      default:
        type = 'gray';
    }
    return type;
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
                        {val.family_name} {val.middle_name} {val.given_name}
                      </Link>
                    ) : (
                      <>
                        {val.family_name} {val.middle_name} {val.given_name}
                      </>
                    )}
                  </TableCell>
                  <TableCell>{val.queue_entry_id}</TableCell>
                  <TableCell>
                    <Tag size="md" type={getTagTypeByStatus(val.status)}>
                      {val.status}
                    </Tag>
                  </TableCell>
                  <TableCell>
                    <Tag size="md" type={getTagTypeByPriority(val.priority)}>
                      {val.priority}
                    </Tag>
                  </TableCell>
                  <TableCell>
                    {val.status === QueueEntryStatus.Waiting ? (
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
                              <OverflowMenuItem itemText="Sign Off" onClick={() => handleSignOff(val)} />
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
