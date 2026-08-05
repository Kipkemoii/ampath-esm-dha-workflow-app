import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Accordion,
    AccordionItem,
    Button,
    ButtonSet,
    StructuredListWrapper,
    StructuredListHead,
    StructuredListBody,
    StructuredListRow,
    StructuredListCell,
    Tag,
    Tile,
    InlineNotification,
} from '@carbon/react';
import { type DefaultWorkspaceProps, formatDate, parseDate, useLayoutType } from '@openmrs/esm-framework';
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
    const layout = useLayoutType();
    const isTablet = layout === 'tablet';

    const orderedTransitions = useMemo(
        () =>
            [...payerPreviewResult.claimTransitions].sort(
                (a, b) => new Date(b.transitionDate).getTime() - new Date(a.transitionDate).getTime(),
            ),
        [payerPreviewResult.claimTransitions],
    );

    return (
        <div className={styles.workspaceContainer}>
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

            <Accordion align={isTablet ? 'start' : 'end'} className={styles.accordion}>
                <AccordionItem title={t('authorization', 'Authorization')} open>
                    <StructuredListWrapper isCondensed>
                        <StructuredListBody>
                            <StructuredListRow>
                                <StructuredListCell className={styles.label}>{t('authCode', 'Auth code')}</StructuredListCell>
                                <StructuredListCell>{payerPreviewResult.authorization.authCode}</StructuredListCell>
                            </StructuredListRow>
                            <StructuredListRow>
                                <StructuredListCell className={styles.label}>{t('status', 'Status')}</StructuredListCell>
                                <StructuredListCell>
                                    <Tag type={getWorkflowTagType(payerPreviewResult.authorization.status)}>
                                        {humanizeState(payerPreviewResult.authorization.status)}
                                    </Tag>
                                </StructuredListCell>
                            </StructuredListRow>
                            <StructuredListRow>
                                <StructuredListCell className={styles.label}>{t('benefitType', 'Benefit type')}</StructuredListCell>
                                <StructuredListCell>{payerPreviewResult.authorization.benefitType}</StructuredListCell>
                            </StructuredListRow>
                            <StructuredListRow>
                                <StructuredListCell className={styles.label}>{t('beneficiaryScheme', 'Scheme')}</StructuredListCell>
                                <StructuredListCell>{payerPreviewResult.authorization.beneficiaryScheme}</StructuredListCell>
                            </StructuredListRow>
                            <StructuredListRow>
                                <StructuredListCell className={styles.label}>{t('expiry', 'Expiry')}</StructuredListCell>
                                <StructuredListCell>{formatDate(parseDate(payerPreviewResult.authorization.expiry))}</StructuredListCell>
                            </StructuredListRow>
                            <StructuredListRow>
                                <StructuredListCell className={styles.label}>{t('needsPreauth', 'Needs pre-auth')}</StructuredListCell>
                                <StructuredListCell>
                                    {payerPreviewResult.authorization.needsPreauth ? t('yes', 'Yes') : t('no', 'No')}
                                </StructuredListCell>
                            </StructuredListRow>
                            <StructuredListRow>
                                <StructuredListCell className={styles.label}>{t('availableBalance', 'Available balance')}</StructuredListCell>
                                <StructuredListCell>KES {formatMoney(payerPreviewResult.authorization.currentAvailableBalance)}</StructuredListCell>
                            </StructuredListRow>
                        </StructuredListBody>
                    </StructuredListWrapper>
                </AccordionItem>

                <AccordionItem title={`${t('interventions', 'Interventions')} (${payerPreviewResult.authorization.interventions.length})`}>
                    <PayerInterventions interventions={payerPreviewResult.authorization.interventions} />
                </AccordionItem>

                <AccordionItem title={`${t('diagnoses', 'Diagnoses')} (${payerPreviewResult.diagnoses.length})`}>
                    <PayerDiagnoses diagnoses={payerPreviewResult.diagnoses} />
                </AccordionItem>

                <AccordionItem title={`${t('claimLines', 'Claim lines')} (${payerPreviewResult.claimLines.length})`}>
                    <PayerClaimLines claimLines={payerPreviewResult.claimLines} />
                </AccordionItem>

                <AccordionItem title={`${t('transitions', 'Transitions')} (${payerPreviewResult.claimTransitions.length})`}>
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
                </AccordionItem>

                <AccordionItem title={`${t('claimNotes', 'Claim notes')} (${payerPreviewResult.claimNotes.length})`} open>
                    <PayerClaimNotes claimNotes={payerPreviewResult.claimNotes} />
                </AccordionItem>

                <AccordionItem title={`${t('claimDoctors', 'Claim doctors')} (${payerPreviewResult.claimDoctors.length})`}>
                    <PayerClaimDoctors claimDoctors={payerPreviewResult.claimDoctors} />
                </AccordionItem>
            </Accordion>

            <ButtonSet className={styles.footer}>
                <Button kind="secondary" onClick={() => closeWorkspace()} className={styles.footerButton}>
                    {t('close', 'Close')}
                </Button>
            </ButtonSet>
        </div>
    );
};

export default PayerPreviewWorkspace;