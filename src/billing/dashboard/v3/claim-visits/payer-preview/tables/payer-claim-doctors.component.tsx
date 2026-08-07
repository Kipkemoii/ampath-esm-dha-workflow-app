import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tile } from "@carbon/react";
import { formatDate, parseDate } from "@openmrs/esm-framework";
import React from "react";
import { useTranslation } from "react-i18next";
import { PayerClaimDoctor } from "../../../../../types";

interface PayerClaimDoctorsProps {
    claimDoctors: PayerClaimDoctor[]
}

const PayerClaimDoctors: React.FC<PayerClaimDoctorsProps> = ({ claimDoctors }) => {
    const { t } = useTranslation();
    return (
        <Tile>
            {t('claimDoctors', 'Claim doctors')}
            <br />
            <br />
            <Table size="sm">
                <TableHead>
                    <TableRow>
                        <TableHeader>No</TableHeader>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Practitioner registry Id</TableHeader>
                        <TableHeader>Practitioner registration No</TableHeader>
                        <TableHeader>Practitioner license No</TableHeader>
                        <TableHeader>Practitioner license validity</TableHeader>
                        <TableHeader>Practitioner license body</TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {claimDoctors &&
                        claimDoctors.map((val, index) => {
                            const doctorProfile = val.doctorProfile;
                            return (
                                <>
                                    <TableRow key={val.name}>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>{val.name}</TableCell>
                                        <TableCell>{doctorProfile.practitionerRegistryId}</TableCell>
                                        <TableCell>{doctorProfile.practitionerRegistrationNumber}</TableCell>
                                        <TableCell>{doctorProfile.practitionerLicenceNumber}</TableCell>
                                        <TableCell>{doctorProfile.practitionerLicenceValidity}</TableCell>
                                        <TableCell>{doctorProfile.practitionerLicenseBody}</TableCell>
                                    </TableRow>
                                </>
                            );
                        })}
                </TableBody>
            </Table>
        </Tile>
    )
}

export default PayerClaimDoctors;