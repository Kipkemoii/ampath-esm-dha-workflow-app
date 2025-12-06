export interface Patient {
  uuid: string;
  display: string;
  queue: {
    display: string;
    uuid: string;
    location: {
      display: string;
      uuid: string;
    };
  };
  status: {
    display: string;
  };
  patient: {
    uuid: string;
    person: {
      gender: string;
      age: number;
    };
  };
}
