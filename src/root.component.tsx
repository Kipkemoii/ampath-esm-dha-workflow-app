import React from 'react';
import styles from './root.scss';
import { WorkspaceContainer } from '@openmrs/esm-framework';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import RegistryComponent from './registry/registry.component';
import LeftPanel from './left-panel/left-panel.component';
import Consultation from './consultation/consultation';
import Triage from './triage/triage.component';

const Root: React.FC = () => {
  return (
    <BrowserRouter basename={`${window.spaBase}/home`}>
      <LeftPanel />
      <main className={styles.container}>
        <Routes>
          <Route path="" element={<RegistryComponent />} />
          <Route path="registry" element={<RegistryComponent />} />
          <Route path="consultation" element={<Consultation />} />
          <Route path="*" element={<RegistryComponent />} />
          <Route path="triage" element={<Triage />} />
        </Routes>
      </main>
      <WorkspaceContainer contextKey="home" />
    </BrowserRouter>
  );
};

export default Root;
