import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@carbon/react";
import React from "react";
import { FhirEncounter } from "../types";
import { formatDate } from "@openmrs/esm-framework";
interface DischargedListProps{
    dischargedEncounters: FhirEncounter[];
    refresh: () => void;
}
const DischargedList: React.FC<DischargedListProps> = ({dischargedEncounters,refresh})=>{
    if(!dischargedEncounters){
       return <>No Data to display</>
    }
    const getPatientName = (display: string): string=>{
         const splitString = display.split("(");
         let names = '';
         if(splitString.length > 0){
            names = splitString[0];
         }
         return names;
    };
    const getPatientIdentifier = (display: string): string=>{
        const splitString = display.split("(");
        let identifier = '';
        if(splitString.length > 1){
           identifier = splitString[1];
        }
        return identifier;
    }
   return <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>No</TableHeader>
            <TableHeader>Discharge Date</TableHeader>
            <TableHeader>Name</TableHeader>
            <TableHeader>Identifier</TableHeader>
          </TableRow>
        </TableHead>

        <TableBody>
          {
          dischargedEncounters.map((val,index)=>{
              return <>
              <TableRow key={val.id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{formatDate(new Date(val.period.start))}</TableCell>
              <TableCell>{getPatientName(val.subject.display ?? '')}</TableCell>
              <TableCell>{getPatientIdentifier(val.subject.display ?? '')}</TableCell>
            </TableRow>
            </>
          })
           
            }
        </TableBody>
      </Table>
   </>
}
export default DischargedList;