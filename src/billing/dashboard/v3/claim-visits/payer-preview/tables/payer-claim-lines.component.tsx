import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tile } from "@carbon/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { PayerClaimLine } from "../../../../../types";

interface PayerClaimLinesProps {
    claimLines: PayerClaimLine[]
}

const PayerClaimLines: React.FC<PayerClaimLinesProps> = ({ claimLines }) => {
    const { t } = useTranslation();
    return (
        <Tile>
            {t('claimLines', 'Claim lines')}
            <br />
            <br />
            <Table size="sm">
                <TableHead>
                    <TableRow>
                        <TableHeader>Item</TableHeader>
                        <TableHeader>Quantity</TableHeader>
                        <TableHeader>Unit price</TableHeader>
                        <TableHeader>Total</TableHeader>
                        <TableHeader>State</TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {claimLines &&
                        claimLines.map((val, index) => {
                            return (
                                <>
                                    <TableRow key={val.id}>
                                        <TableCell>{val.name}</TableCell>
                                        <TableCell>{val.quantity}</TableCell>
                                        <TableCell>{val.unitPrice}</TableCell>
                                        <TableCell>{val.claimLineTotal}</TableCell>
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

export default PayerClaimLines;