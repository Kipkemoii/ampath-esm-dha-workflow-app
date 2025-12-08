import React from 'react';
import styles from './root.scss';
import { WorkspaceContainer } from '@openmrs/esm-framework';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import RegistryComponent from './registry/registry.component';
import LeftPanel from './left-panel/left-panel.component';
import Triage from './triage/triage.component';
import ServiceQueue from './service-queues/service-queue';
import LaboratoryComponent from './laboratory/laboratory.component';
import AppointmentsComponent from './appointments/appointments.component';
import PharmacyComponent from './pharmacy/pharmacy.component';

const Root: React.FC = () => {
  return (
    <BrowserRouter basename={`${window.spaBase}/home`}>
      <LeftPanel />
      <main className={styles.container}>
        <Routes>
          <Route path="" element={<RegistryComponent />} />
          <Route path="registry" element={<RegistryComponent />} />
          <Route path="consultation" element={<ServiceQueue isTriage={false} />} />
          <Route path="triage" element={<Triage />} />
          <Route path="laboratory" element={<LaboratoryComponent />} />
          <Route path="pharmacy" element={<PharmacyComponent />} />
          <Route path="appointments" element={<AppointmentsComponent />} />
          <Route path="*" element={<RegistryComponent />} />
        </Routes>
      </main>
      <WorkspaceContainer contextKey="home" />
    </BrowserRouter>
  );
};

export default Root;
