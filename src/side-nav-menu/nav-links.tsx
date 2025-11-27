import { SideNavMenuItem } from '@carbon/react';
import React from 'react';

interface NavLinksProps {}
const NavLinks: React.FC<NavLinksProps> = () => {
  return (
    <>
      <SideNavMenuItem id="1" href="workflow/registry">
        Dashboard
      </SideNavMenuItem>
      <SideNavMenuItem id="2" href="workflow/registry">
        Registration
      </SideNavMenuItem>
      <SideNavMenuItem href="workflow/registry">Appointments</SideNavMenuItem>
      <SideNavMenuItem href="workflow/registry">Triage</SideNavMenuItem>
      <SideNavMenuItem href="workflow/registry">Consultation</SideNavMenuItem>
      <SideNavMenuItem href="workflow/registry">Laboratory</SideNavMenuItem>
      <SideNavMenuItem href="workflow/registry">Bookings</SideNavMenuItem>
      <SideNavMenuItem href="workflow/registry">Reports</SideNavMenuItem>
      <SideNavMenuItem href="workflow/registry">Registers</SideNavMenuItem>
    </>
  );
};

export default NavLinks;
