import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@carbon/react';
import { claimVisitToken, useFacilityClaimVisits } from '../../../billing-claims.resource';
import { fetchPreauthPreviewRowsForTokens, type PreauthPreviewRow } from '../../../../claims/claims.resource';
import { PREAUTH_BUCKETS, preauthBucketKeyForStatus, type StatusBucket } from './claim-status';
import PreauthPreviewTable from './preauths-datatables/preauth-preview-table.component';
import styles from './facility-bills.component.scss';

const defaultBucketKey = (buckets: StatusBucket[]): string =>
  (buckets.find((b) => b.key === 'pending') ?? buckets[0])?.key ?? '';

interface PreauthsProps {
  locationUuid: string;
  billingDate: string;
}

/**
 * Status view under Preauthorizations — lists HIE preauths from GET /pre-auth/preview.
 *
 * Status filters are a wrapping chip row (not nested Tabs / ContentSwitcher) so they
 * stay clear of Accounting → Preauthorizations → Needs raise / Elective / Status.
 */
const Preauths: React.FC<PreauthsProps> = ({ locationUuid, billingDate }) => {
  const statusItems: StatusBucket[] = useMemo(
    () => [...PREAUTH_BUCKETS, { key: '', label: 'All', statuses: [] }],
    [],
  );
  const [statusFilter, setStatusFilter] = useState<string>(() => defaultBucketKey(PREAUTH_BUCKETS));
  const [rows, setRows] = useState<PreauthPreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const {
    claimVisits,
    loading: visitsLoading,
    reload: reloadVisits,
  } = useFacilityClaimVisits(locationUuid, billingDate);

  // `force` skips the short cache that stops the several places reading this endpoint from
  // each paying for the same call. Refresh is someone asking for the current answer, so it
  // goes to the HIE; the load that happens on its own is content to share.
  const loadPreviews = useCallback(
    async (force = false) => {
      if (!locationUuid) return;
      const tokens = (claimVisits ?? []).map(claimVisitToken).filter(Boolean);
      if (!tokens.length) {
        setRows([]);
        return;
      }
      setLoadingPreview(true);
      try {
        const previewRows = await fetchPreauthPreviewRowsForTokens(tokens, locationUuid, { force });
        setRows(previewRows);
      } finally {
        setLoadingPreview(false);
      }
    },
    [claimVisits, locationUuid],
  );

  useEffect(() => {
    if (visitsLoading) return;
    loadPreviews();
  }, [visitsLoading, loadPreviews]);

  const handleRefresh = useCallback(() => {
    reloadVisits();
    loadPreviews(true);
  }, [reloadVisits, loadPreviews]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const bucket of PREAUTH_BUCKETS) {
      map[bucket.key] = 0;
    }
    for (const row of rows) {
      const key = preauthBucketKeyForStatus(row.status);
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter((r) => preauthBucketKeyForStatus(r.status) === statusFilter);
  }, [rows, statusFilter]);

  const loading = visitsLoading || loadingPreview;

  return (
    <div>
      <div className={styles.statusFilters} role="tablist" aria-label="Preauth statuses">
        {statusItems.map((bucket) => {
          const key = bucket.key || 'all';
          const selected = statusFilter === bucket.key;
          const count = bucket.key ? (counts[bucket.key] ?? 0) : rows.length;
          return (
            <Button
              key={key}
              role="tab"
              aria-selected={selected}
              size="sm"
              kind={selected ? 'primary' : 'tertiary'}
              className={styles.statusFilterBtn}
              onClick={() => setStatusFilter(bucket.key)}
            >
              {bucket.label}
              <span className={selected ? styles.statusFilterCountOn : styles.statusFilterCount}>
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      <div className={styles.tableCard}>
        <PreauthPreviewTable
          rows={filteredRows}
          locationUuid={locationUuid}
          loading={loading}
          onRefresh={handleRefresh}
        />
      </div>
    </div>
  );
};

export default Preauths;
