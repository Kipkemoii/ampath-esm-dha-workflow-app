import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ICUQueues from './icu/icu-queues.component';
import HDUQueues from './hdu/hdu-queues.component';
import NICUQueues from './nicu/nicu-queues.component';
import PICUQueues from './picu/picu-queues.component';
import ICUBurnsQueues from './icu-burns/icu-burns-queues.component';

const CriticalCareUnitRoot: React.FC = () => {
  return (
    <BrowserRouter basename={`${window.spaBase}/home/critical-care-unit`}>
      <Routes>
        <Route path="/icu" element={<ICUQueues />} />
        <Route path="/hdu" element={<HDUQueues />} />
        <Route path="/nicu" element={<NICUQueues />} />
        <Route path="/picu" element={<PICUQueues />} />
        <Route path="/icu-burns" element={<ICUBurnsQueues />} />
      </Routes>
    </BrowserRouter>
  );
};

export default CriticalCareUnitRoot;
