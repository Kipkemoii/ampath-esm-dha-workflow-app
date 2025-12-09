export interface Patient {
  uuid: string;
  middle_name: string;
  given_name: string;
  family_name: string;
  queue_room: string;
  status: string | number;
  patient_name: string;
  patient_uuid: string;
  priority: string | number;
}

export interface Room {
  name: string;
  patients: Patient[];
}
