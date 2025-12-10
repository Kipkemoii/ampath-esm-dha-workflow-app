import React, { useEffect, useState } from 'react';
import { ExtensionSlot, WorkspaceContainer } from '@openmrs/esm-framework';

const AccountingComponent: React.FC = () => {
  
  return (
    <div>
      <ExtensionSlot name="poc-accounting-dashboard-slot" />
    </div>
  );
};

export default AccountingComponent;
