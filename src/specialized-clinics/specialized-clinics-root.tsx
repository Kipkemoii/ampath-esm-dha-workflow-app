import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import OncologyQueues from './oncology/oncology-queues.component';
import DentalQueues from './dental/dental-queues.component';
import DiagnosticAndImagingQueues from './diagnostic-and-imaging/diagnostic-and-imaging.component';
import OphthalmologyQueues from './ophthalmology/ophthalmology-queues.component';
import PsychiatryQueues from './psychiatry/psychiatry-queues.component';
import RenalQueues from './renal/renal-queues.component';

const SpecializedClinicsRoot: React.FC = () => {
  return (
    <BrowserRouter basename={`${window.spaBase}/home/specialized-clinics`}>
      <Routes>
        <Route path="/renal" element={<RenalQueues/>} />
        <Route path="/oncology" element={<OncologyQueues />} />
        <Route path="/dental" element={<DentalQueues />} />
        <Route path="/diagnostic-and-imaging" element={<DiagnosticAndImagingQueues />} />
        <Route path="/ophthalmology" element={<OphthalmologyQueues />} />
        <Route path="/psychiatry" element={<PsychiatryQueues />} />
      </Routes>
    </BrowserRouter>
  );
};

export default SpecializedClinicsRoot;
