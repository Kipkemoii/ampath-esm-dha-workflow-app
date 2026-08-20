import React from "react";
import styles from './claim-stat.component.scss';
import { formatToTitleCase } from "../../../../../shared/utils/format-title-case";
import { type ClaimPayerStatus, type ClaimProviderStatus } from "../../types";
interface claimStat {
    title: any;
    count: number | string;
    onStatClick: (title: string)=> void;
}
const ClaimStat: React.FC<claimStat> = ({title,count,onStatClick})=>{
  function handleStatClick(){
     onStatClick(title);
  }
  
  return <>
    <div className={styles.claimStatLayout}>
       <div className={styles.claimStatHeader}>
           <h5 className={styles.statsTitle}>{title ? formatToTitleCase(title) : ''}</h5>
       </div>
       <div className={styles.claimStatContent}>
            <div className={styles.claimStatCount}>
               <h3 className={styles.navStat} onClick={handleStatClick}>{count ?? 0}</h3>
            </div>
       </div>
    </div>
  </>
}
export default ClaimStat;