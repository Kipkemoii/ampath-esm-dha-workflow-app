import React from 'react';
import { Grid, Column } from '@carbon/react';
import BillingTotalsRow from '../../billing/widgets/billingTotalsRow.component';

import { spacing07 } from '@carbon/themes';

const BillingDashboard: React.FC = () => {
  return (
    <Grid fullWidth>
      <Column lg={16} md={8} sm={4}>
        <div
          style={{
            position: 'relative',
            marginLeft: `-${spacing07}`,
            marginRight: `-${spacing07}`,
          }}
        >
          <BillingTotalsRow />
        </div>
      </Column>
    </Grid>
  );
};

export default BillingDashboard;
