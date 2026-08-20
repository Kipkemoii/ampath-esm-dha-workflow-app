import React from "react";
import styles from './claim-stats-list.modal.scss';
import { Modal } from "@carbon/react";
import BillingAndClaimsPatientChart from "../../../../v2/billing-and-claims-patient-chart.component";
import { type ClaimVisit } from "../../../../../types";
interface claimStatsListModalProps {
  open: boolean;
  indicator: string;
  onCloseClaimStatsListModal: ()=>void;
  claimVisits: ClaimVisit[];
}
const ClaimStatsListModal: React.FC<claimStatsListModalProps> = ({open,indicator,onCloseClaimStatsListModal,claimVisits})=>{
   return <>
   <div className={styles.statsListModalLayout}>
      <Modal
        open={open}
        modalHeading={indicator}
        passiveModal
        onRequestClose={onCloseClaimStatsListModal}
        size="lg"
      >
       <BillingAndClaimsPatientChart claimVisits={claimVisits}/>
      </Modal>
   </div>
   </>
}
export default ClaimStatsListModal;