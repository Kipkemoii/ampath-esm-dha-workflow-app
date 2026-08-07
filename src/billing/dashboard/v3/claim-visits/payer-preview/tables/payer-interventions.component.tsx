import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tile } from "@carbon/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { PayerIntervention } from "../../../../../types";

interface PayerInterventionsProps {
    interventions: PayerIntervention[]
}

const PayerInterventions: React.FC<PayerInterventionsProps> = ({ interventions }) => {
    const { t } = useTranslation();
    return (
        <Tile>
            {t('interventions', 'Interventions')}
            <br />
            <br />
            <Table size="sm">
                <TableHead>
                    <TableRow>
                        <TableHeader>Code</TableHeader>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Payment mechanism</TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {interventions &&
                        interventions.map((val, index) => {
                            return (
                                <>
                                    <TableRow key={val.id}>
                                        <TableCell>{val.code}</TableCell>
                                        <TableCell>{val.name}</TableCell>
                                        <TableCell>{val.paymentMechanism}</TableCell>
                                    </TableRow>
                                </>
                            );
                        })}
                </TableBody>
            </Table>
        </Tile>
    )
}

export default PayerInterventions;