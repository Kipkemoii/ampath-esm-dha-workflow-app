import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tile } from "@carbon/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { PayerDiagnosis } from "../../../../../types";

interface PayerDiagnosesProps {
    diagnoses: PayerDiagnosis[]
}

const PayerDiagnoses: React.FC<PayerDiagnosesProps> = ({ diagnoses }) => {
    const { t } = useTranslation();
    return (
        <Tile>
            {t('diagnosis', 'Diagnosis')}
            <br />
            <br />
            <Table size="sm">
                <TableHead>
                    <TableRow>
                        <TableHeader>Diagnosis</TableHeader>
                        <TableHeader>Code</TableHeader>
                        <TableHeader>Code type</TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {diagnoses &&
                        diagnoses.map((val, index) => {
                            return (
                                <>
                                    <TableRow key={index}>
                                        <TableCell>{val.name}</TableCell>
                                        <TableCell>{val.siteCode}</TableCell>
                                        <TableCell>{val.siteCodeType}</TableCell>
                                    </TableRow>
                                </>
                            );
                        })}
                </TableBody>
            </Table>
        </Tile>
    )
}

export default PayerDiagnoses;