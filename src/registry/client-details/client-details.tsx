import React, { useMemo } from 'react';
import { type HieClient } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { generateHieClientDetails } from '../utils/hie-adapter';
interface ClientDetailsProps {
  client: HieClient;
}
export const ClientDetails: React.FC<ClientDetailsProps> = ({ client }) => {
  const clientDetails = useMemo(() => generateHieClientDetails(client), [client]);

  if (!client || !clientDetails) {
    return (
      <>
        <h4>No patient Data to Display</h4>
      </>
    );
  }
  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Field</TableHeader>
            <TableHeader>Value</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.keys(clientDetails).map((key) => (
            <TableRow>
              <TableCell>{key}</TableCell>
              <TableCell>{clientDetails[key]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
};

export default ClientDetails;
