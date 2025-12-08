import React, { useEffect, useState } from 'react';
import { ExtensionSlot, WorkspaceContainer } from '@openmrs/esm-framework';

const AppointmentsComponent: React.FC = () => {
  
  return (
    <div>
      <ExtensionSlot name="clinical-appointments-dashboard-slot" />
    </div>
  );
};

export default AppointmentsComponent;
