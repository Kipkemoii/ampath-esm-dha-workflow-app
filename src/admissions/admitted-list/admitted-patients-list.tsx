import React, { useState } from 'react';
import { OverflowMenu, OverflowMenuItem, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { BedLayout } from '../types';
import BedSwapModal from '../modal/bed-swap/bed-swap.modal';
import DischargeModal from '../modal/discharge/discharge-patient.modal';

interface AdmittedPatientsListProps {
  admittedPatientsData: BedLayout[];
  refresh: ()=> void;
}

const AdmittedPatientsList: React.FC<AdmittedPatientsListProps> = ({ admittedPatientsData, refresh }) => {
  const [showBedSwapModal,setShowBedSwapModal]= useState<boolean>(false);
  const [showDischargeModal,setShowDischargeModal]= useState<boolean>(false);
  const [selectedLayout,setSelectedLayout] = useState<any>();
  if(!admittedPatientsData){
   return <>No data to display</>
  }
  const handleTransferRequest = (layout: BedLayout)=>{
    setSelectedLayout(layout);
  };
  const handleBedSwapRequest = (layout: BedLayout)=>{
    setSelectedLayout(layout);
    setShowBedSwapModal(true);
  };
  const handleDischargeRequest = (layout: BedLayout)=>{
    setSelectedLayout(layout);
    setShowDischargeModal(true);
  };
  const handleBedSwapModalClose = ()=>{
    setShowBedSwapModal(false);
    refresh()
  }
  const handleDischargeModalClose = ()=>{
    setShowDischargeModal(false);
  }
  const handleSuccessfullDischarge = ()=>{
    handleBedSwapModalClose();
    refresh();
  }
  const rows =
    admittedPatientsData?.flatMap((layout) =>
      (layout.patients ?? []).map((patient) => ({
        key: `${layout.bedUuid}-${patient.uuid}`,
        bedNumber: layout.bedNumber,
        bedId: layout.bedId,
        status: layout.status,
        location: layout.location,
        name: patient.person.display,
        gender: patient.person.gender,
        age: patient.person.age,
        identifier: patient.identifiers?.[0]?.identifier ?? 'N/A',
        person: patient.person
      })),
    ) ?? [];

  if (!rows.length) {
    return <>No Data</>;
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
          <TableHeader>Status</TableHeader>
          <TableHeader>Location</TableHeader>
          <TableHeader>Action</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={row.key}>
            <TableCell>{index + 1}</TableCell>
            <TableCell>{row.bedNumber}</TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.gender}</TableCell>
            <TableCell>{row.age}</TableCell>
            <TableCell>{row.identifier}</TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell>{row.location}</TableCell>
            <TableCell>
            <>
                    <OverflowMenu aria-label="overflow-menu">
                      <OverflowMenuItem itemText="Transfer" onClick={() => handleTransferRequest(row as any)} />
                      <OverflowMenuItem itemText="Bed Swap" onClick={() => handleBedSwapRequest(row as any)} />
                      <OverflowMenuItem itemText="Discharge" onClick={() => handleDischargeRequest(row as any)} />
                    </OverflowMenu>
                </>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    {
      showBedSwapModal && selectedLayout ? (<>
       <BedSwapModal 
       open={showBedSwapModal} 
       onModalClose={handleBedSwapModalClose} 
       onSuccessfullBedSwap={handleBedSwapModalClose} 
       disposition={null}
       person={selectedLayout.person}
       bedLayouts={admittedPatientsData}/>
      </>): (<></>)
    }

    {
      showDischargeModal &&  selectedLayout ? (<>
      <DischargeModal 
      open={showDischargeModal} 
      onModalClose={handleDischargeModalClose}
      onDischarge={handleSuccessfullDischarge}
      admissionRequest={selectedLayout}
      />
      </>) : (<></>)
      
    }
    
    </>
  );
};

export default AdmittedPatientsList;

