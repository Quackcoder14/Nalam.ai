import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export interface Patient {
  id: string;
  name: string;
  dob: string;
  gender: string;
  contact: string;
  consent_emergency: string;
  consent_specialist: string;
  consent_research: string;
}

export interface MedicalRecord {
  record_id: string;
  patient_id: string;
  date: string;
  type: string;
  provider: string;
  diagnosis: string;
  notes: string;
  lab_results: string;
}

const patientsFile = path.join(process.cwd(), 'data', 'patients.csv');
const recordsFile = path.join(process.cwd(), 'data', 'medical_records.csv');

export async function getPatients(): Promise<Patient[]> {
  const csvContent = fs.readFileSync(patientsFile, 'utf-8');
  return new Promise((resolve) => {
    Papa.parse<Patient>(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
    });
  });
}

export async function getPatientById(id: string): Promise<Patient | null> {
  const patients = await getPatients();
  return patients.find(p => p.id === id) || null;
}

export async function getMedicalRecords(patientId: string): Promise<MedicalRecord[]> {
  const csvContent = fs.readFileSync(recordsFile, 'utf-8');
  return new Promise((resolve) => {
    Papa.parse<MedicalRecord>(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const records = results.data.filter(r => r.patient_id === patientId);
        resolve(records);
      },
    });
  });
}

export async function updatePatientConsent(id: string, emergency: string, specialist: string, research: string) {
    const patients = await getPatients();
    const updatedPatients = patients.map(p => {
        if (p.id === id) {
            return {
                ...p,
                consent_emergency: emergency,
                consent_specialist: specialist,
                consent_research: research
            }
        }
        return p;
    });

    const csv = Papa.unparse(updatedPatients);
    fs.writeFileSync(patientsFile, csv, 'utf-8');
    return true;
}
