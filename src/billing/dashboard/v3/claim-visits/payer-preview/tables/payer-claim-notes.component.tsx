import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tile } from "@carbon/react";
import { formatDate, parseDate } from "@openmrs/esm-framework";
import React from "react";
import { useTranslation } from "react-i18next";
import { PayerClaimNote } from "../../../../../types";

interface PayerClaimNotesProps {
    claimNotes: PayerClaimNote[]
}

const PayerClaimNotes: React.FC<PayerClaimNotesProps> = ({ claimNotes }) => {
    const { t } = useTranslation();
    return (
        <Tile>
            {t('claimNotes', 'Claim notes')}
            <br />
            <br />
            <Table size="sm">
                <TableHead>
                    <TableRow>
                        <TableHeader>Note</TableHeader>
                        <TableHeader>Author</TableHeader>
                        <TableHeader>Source</TableHeader>
                        <TableHeader>Workflow state</TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {claimNotes &&
                        claimNotes.map((val, index) => {
                            return (
                                <>
                                    <TableRow key={val.id}>
                                        <TableCell>{val.note}</TableCell>
                                        <TableCell>{val.author}</TableCell>
                                        <TableCell>{val.source}</TableCell>
                                        <TableCell>{val.workflowState}</TableCell>
                                    </TableRow>
                                </>
                            );
                        })}
                </TableBody>
            </Table>
        </Tile>
    )
}

export default PayerClaimNotes;