import React, { useEffect, useState } from 'react';
import { ExtensionSlot, WorkspaceContainer } from '@openmrs/esm-framework';

const PharmacyComponent: React.FC = () => {
  
  return (
    <div>
      <ExtensionSlot name="poc-pharmacy-dashboard-slot" />
    </div>
  );
};

export default PharmacyComponent;
