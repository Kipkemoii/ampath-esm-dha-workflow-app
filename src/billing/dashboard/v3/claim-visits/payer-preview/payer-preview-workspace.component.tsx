import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Button,
    ButtonSet,
    Tag,
    Tile,
    InlineNotification,
} from '@carbon/react';
import { type DefaultWorkspaceProps, formatDate, parseDate } from '@openmrs/esm-framework';
import styles from './index.scss';
import { PayerPreviewResult } from '../../../../types';
import PayerClaimDoctors from './tables/payer-claim-doctors.component';
import PayerClaimNotes from './tables/payer-claim-notes.component';
import PayerClaimLines from './tables/payer-claim-lines.component';
import PayerDiagnoses from './tables/payer-diagnoses.component';
import PayerInterventions from './tables/payer-interventions.component';

export interface ClaimDetailsWorkspaceProps extends DefaultWorkspaceProps {
    payerPreviewResult: PayerPreviewResult;
}

const workflowStateTagType: Record<string, 'red' | 'blue' | 'purple' | 'cyan' | 'gray' | 'green'> = {
    SENT_BACK: 'red',
    REJECTED: 'red',
    AUTOMATIC_CHECKS_DONE: 'blue',
    SUBMITTED_PAYER: 'purple',
    SUBMITTED_PROVIDER: 'cyan',
    DRAFT_PROVIDER: 'gray',
    APPROVED: 'green',
};

function getWorkflowTagType(state: string) {
    return workflowStateTagType[state] ?? 'gray';
}

function humanizeState(state: string) {
    return state.replace(/_/g, ' ');
}

function formatMoney(value: string) {
    const amount = Number(value);
    return Number.isNaN(amount) ? value : amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

const PayerPreviewWorkspace: React.FC<ClaimDetailsWorkspaceProps> = ({ payerPreviewResult, closeWorkspace }) => {
    const { t } = useTranslation();

    const orderedTransitions = useMemo(
        () =>
            [...payerPreviewResult.claimTransitions].sort(
                (a, b) => new Date(b.transitionDate).getTime() - new Date(a.transitionDate).getTime(),
            ),
        [payerPreviewResult.claimTransitions],
    );

    return (
        <div className={styles.workspaceContainer}>
            <div className={styles.tiles}>
                <Tile className={styles.summaryTile}>
                    <div className={styles.summaryHeaderRow}>
                        <div>
                            <p className={styles.memberName}>{payerPreviewResult.memberName}</p>
                            <p className={styles.memberMeta}>
                                {t('memberNumber', 'Member No.')} {payerPreviewResult.memberNumber} · {payerPreviewResult.schemeName}
                            </p>
                        </div>
                        <Tag type={getWorkflowTagType(payerPreviewResult.workflowState)} size="md">
                            {humanizeState(payerPreviewResult.workflowState)}
                        </Tag>
                    </div>

                    {payerPreviewResult.workflowDisplayName && (
                        <InlineNotification
                            kind={payerPreviewResult.workflowState === 'SENT_BACK' ? 'warning' : 'info'}
                            title={payerPreviewResult.workflowDisplayName}
                            lowContrast
                            hideCloseButton
                            className={styles.workflowNotification}
                        />
                    )}

                    <div className={styles.summaryGrid}>
                        <div>
                            <p className={styles.label}>{t('provider', 'Provider')}</p>
                            <p className={styles.value}>{payerPreviewResult.providerName}</p>
                        </div>
                        <div>
                            <p className={styles.label}>{t('claimType', 'Claim type')}</p>
                            <p className={styles.value}>{payerPreviewResult.claimType}</p>
                        </div>
                        <div>
                            <p className={styles.label}>{t('trackingNumber', 'Tracking No.')}</p>
                            <p className={styles.value}>{payerPreviewResult.trackingNumber}</p>
                        </div>
                        <div>
                            <p className={styles.label}>{t('providerClaimNo', 'Provider claim No.')}</p>
                            <p className={styles.value}>{payerPreviewResult.providerClaimNo}</p>
                        </div>
                        <div>
                            <p className={styles.label}>{t('billPeriod', 'Bill period')}</p>
                            <p className={styles.value}>
                                {formatDate(parseDate(payerPreviewResult.billFrom))} – {formatDate(parseDate(payerPreviewResult.billTo))}
                            </p>
                        </div>
                        <div>
                            <p className={styles.label}>{t('proposedValue', 'Proposed value')}</p>
                            <p className={styles.value}>KES {formatMoney(payerPreviewResult.proposedValueLessCopays)}</p>
                        </div>
                    </div>
                </Tile>
                <br />
                <br />
                <PayerClaimNotes claimNotes={payerPreviewResult.claimNotes} />
                <br />
                <br />
                <PayerClaimDoctors claimDoctors={payerPreviewResult.claimDoctors} />
                <br />
                <br />
                <PayerDiagnoses diagnoses={payerPreviewResult.diagnoses} />
                <br />
                <br />
                <PayerInterventions interventions={payerPreviewResult.authorization.interventions} />
                <br />
                <br />
                <PayerClaimLines claimLines={payerPreviewResult.claimLines} />
                <br />
                <Tile>
                    {t('transitions', 'Transitions')}
                    <br />
                    <br />
                    <ul className={styles.timeline}>
                        {orderedTransitions.map((transition) => (
                            <li key={transition.guid} className={styles.timelineItem}>
                                <div className={styles.timelineDot} />
                                <div>
                                    <p className={styles.value}>
                                        {humanizeState(transition.workflowStateFrom)} → {humanizeState(transition.workflowStateTo)}
                                    </p>
                                    <p className={styles.label}>{formatDate(parseDate(transition.transitionDate), { time: true })}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Tile>
            </div>

            <ButtonSet className={styles.footer}>
                <Button kind="secondary" onClick={() => closeWorkspace()} className={styles.footerButton}>
                    {t('close', 'Close')}
                </Button>
            </ButtonSet>
        </div>
    );
};

export default PayerPreviewWorkspace;