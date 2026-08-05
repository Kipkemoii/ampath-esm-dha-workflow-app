import React from "react";
import { type ClaimAttachment, type ApplicableDocumentType } from "../../types";
import styles from './claim-documents.scss';
interface claimDocumentsProps {
    claimAttachments?: ClaimAttachment[];
}
const ClaimDocuments: React.FC<claimDocumentsProps> = ({claimAttachments})=>{
   if(!claimAttachments || claimAttachments.length === 0){
       return <>No Attachments</>
   }
  return <>
   <div className={styles.claimDocummentLayout}>
        {
           claimAttachments.map((at)=>{
                return <>
                <div>
                   <span><a href={at.data}>{at.title} ({at.attachment_type} - {at.intervention_code})</a></span>
                </div>
                </>
           })
        }
   </div>
  </>
}
export default ClaimDocuments;