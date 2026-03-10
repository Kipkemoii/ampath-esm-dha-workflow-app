import React from 'react';
import styles from './root.scss';
import { useLeftNav } from '@openmrs/esm-framework';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import BillingDashboard from './dashboard/billingDashboard.component';
import Invoice from './invoice/invoice';

const BillingRoot: React.FC = () => {
  const spaBasePath = window.spaBase;
  return (
    <BrowserRouter basename={`${window.spaBase}/home/billing`}>
      <Routes>
        <Route path="" element={<BillingDashboard />} />
        <Route path="/patient/:patientUuid/:billUuid" element={<Invoice />} />
      </Routes>
    </BrowserRouter>
  );
};

export default BillingRoot;
