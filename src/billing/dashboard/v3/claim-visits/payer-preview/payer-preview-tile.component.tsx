import React, { useEffect } from "react";
import { PayerPreviewResult } from "../../../../types";
import { Button, InlineLoading, Tile } from "@carbon/react";
import styles from "./index.scss";
import { launchWorkspace } from "@openmrs/esm-framework";
import { AccessibilityColor } from "@carbon/react/icons";

interface PayerPreviewTileProps {
    isLoadingPayerPreview: boolean;
    payerPreviewResult: PayerPreviewResult;
}

const PayerPreviewTile: React.FC<PayerPreviewTileProps> = ({ isLoadingPayerPreview, payerPreviewResult }) => {
    const handlePayerPreview = () => {
        launchWorkspace('payer-preview-workspace', {
            payerPreviewResult
        });
    }

    if (isLoadingPayerPreview) {
        return <InlineLoading title='Loading payer preview...' />;
    }

    if (!isLoadingPayerPreview && !payerPreviewResult) {
        return;
    }

    return (
        <Tile
            id="payer-preview"
        >
            <dd>Payer preview</dd>
            <br />
            <br />
            {
                (!isLoadingPayerPreview && payerPreviewResult) ?
                    <>
                        <dl className={styles.detailsGrid}>
                            <div className={styles.detailRow}>
                                <dt>Workflow state</dt>
                                <dd>{payerPreviewResult.workflowState}</dd>
                            </div>
                            <div className={styles.detailRow}>
                                <dt>Workflow display name</dt>
                                <dd>{payerPreviewResult.workflowDisplayName}</dd>
                            </div>
                            <Button kind='tertiary' size="md" renderIcon={AccessibilityColor} onClick={handlePayerPreview}>View</Button>
                        </dl>
                    </> : <></>
            }
        </Tile>
    )
}

export default PayerPreviewTile;