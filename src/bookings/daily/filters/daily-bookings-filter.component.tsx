import React, { useRef } from 'react';
import { Button, DatePicker, DatePickerInput, Dropdown, type OnChangeData } from '@carbon/react';
import styles from './daily-bookings-filter.component.scss';
import { type BookingFilter } from '../../types';
import { useSession } from '@openmrs/esm-framework';

interface DailyBookingsFilterProps {
  filterSelected: (filters: BookingFilter) => void;
}
const DailyBookingsFilter: React.FC<DailyBookingsFilterProps> = ({ filterSelected }) => {
  const dateRef = useRef<string>('');
  const departmentRef = useRef<string>();
  const session = useSession();
  const locationUuid = session.sessionLocation.uuid;
  const handleDateChange = (dateSelected: Date[]) => {
    dateRef.current = new Date(dateSelected[0]).toLocaleDateString('en-CA');
  };
  const handleDepartmentChange = (selectedDept: OnChangeData<{ text: string }>) => {
    departmentRef.current = selectedDept.selectedItem.text;
  };
  const handeleGenerateFilters = () => {
    const filters: BookingFilter = {
      startDate: dateRef.current,
      department: departmentRef.current,
      locationUuids: locationUuid,
    };
    filterSelected(filters);
  };
  return (
    <>
      <div className={styles.filterLayout}>
        <div className={styles.filterRow}>
          <div className={styles.filterFormGroup}>
            <DatePicker
              datePickerType="single"
              locale="en"
              onChange={handleDateChange}
              onClose={() => {}}
              onOpen={() => {}}
            >
              <DatePickerInput id="date-picker-single" labelText="Date" placeholder="mm/dd/yyyy" />
            </DatePicker>
          </div>
          <div className={styles.filterFormGroup}>
            <Dropdown
              id="department"
              invalidText="invalid selection"
              itemToString={(item) => item.text}
              onChange={handleDepartmentChange}
              items={[
                {
                  text: 'HIV',
                },
                {
                  text: 'CDM',
                },
                {
                  text: 'ONCOLOGY',
                },
              ]}
              label="Select Department"
              titleText="Department"
              type="default"
              warnText=""
            />
          </div>
        </div>
        <div className={styles.filterRow}>
          <div className={styles.filterFormGroup}>
            <Button kind="primary" onClick={handeleGenerateFilters}>
              Generate
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DailyBookingsFilter;
