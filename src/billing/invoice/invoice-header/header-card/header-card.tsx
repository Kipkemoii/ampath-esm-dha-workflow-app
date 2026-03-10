import React from 'react';
import styles from './header-card.scss';
interface HeaderCardProps {
  title: string;
  subTitle: string;
}
const HeaderCard: React.FC<HeaderCardProps> = ({ title, subTitle }) => {
  return (
    <>
      <div className={styles.headerCardLayout}>
        <div className={styles.headerTitle}>
          <h5>{title}</h5>
        </div>
        <div className={styles.headerDetails}>
          <p>{subTitle}</p>
        </div>
      </div>
    </>
  );
};
export default HeaderCard;
