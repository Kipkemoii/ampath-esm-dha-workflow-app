import React, { useEffect, useState } from 'react';
import { ExtensionSlot, WorkspaceContainer } from '@openmrs/esm-framework';

const LaboratoryComponent: React.FC = () => {
  
  return (
    <div>
      <ExtensionSlot name="laboratory-dashboard-slot" />
    </div>
  );
};

export default LaboratoryComponent;
