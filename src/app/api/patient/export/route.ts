import { NextResponse } from 'next/server';
import { getPatientById, getMedicalRecords } from '@/lib/data';

// Generate UUID v4 for FHIR fullUrls
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    const patient = await getPatientById(id);
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const records = await getMedicalRecords(id);

    // ABDM FHIR R4 document structure
    const bundleId = generateUUID();
    const compositionId = generateUUID();
    const patientResourceId = generateUUID();
    const practitionerId = generateUUID();

    const entries = [];

    // 1. Composition
    entries.push({
      fullUrl: `urn:uuid:${compositionId}`,
      resource: {
        resourceType: 'Composition',
        id: compositionId,
        status: 'final',
        type: {
          coding: [{ system: 'http://snomed.info/sct', code: '373942005', display: 'Discharge Summary' }]
        },
        subject: { reference: `urn:uuid:${patientResourceId}` },
        date: new Date().toISOString(),
        author: [{ reference: `urn:uuid:${practitionerId}` }],
        title: 'ABDM Exported Health Vault',
      }
    });

    // 2. Patient
    entries.push({
      fullUrl: `urn:uuid:${patientResourceId}`,
      resource: {
        resourceType: 'Patient',
        id: patientResourceId,
        identifier: [{ system: 'https://ndhm.gov.in', value: patient.id }],
        name: [{ text: patient.name }],
        gender: patient.gender.toLowerCase() === 'female' ? 'female' : patient.gender.toLowerCase() === 'male' ? 'male' : 'other',
        birthDate: patient.dob,
        telecom: [{ system: 'phone', value: patient.mobile || patient.contact }]
      }
    });

    // 3. Practitioner
    entries.push({
      fullUrl: `urn:uuid:${practitionerId}`,
      resource: {
        resourceType: 'Practitioner',
        id: practitionerId,
        name: [{ text: 'Sentinel Automated System' }]
      }
    });

    // 4. Clinical Records (Conditions & Observations)
    records.forEach((record: any) => {
      const recordId = generateUUID();
      entries.push({
        fullUrl: `urn:uuid:${recordId}`,
        resource: {
          resourceType: 'Condition',
          id: recordId,
          clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
          code: { text: record.diagnosis || record.type },
          subject: { reference: `urn:uuid:${patientResourceId}` },
          recordedDate: new Date(record.date).toISOString(),
          note: [{ text: record.notes }]
        }
      });

      if (record.lab_results) {
        const obsId = generateUUID();
        entries.push({
          fullUrl: `urn:uuid:${obsId}`,
          resource: {
            resourceType: 'Observation',
            id: obsId,
            status: 'final',
            code: { text: 'Lab Result' },
            subject: { reference: `urn:uuid:${patientResourceId}` },
            effectiveDateTime: new Date(record.date).toISOString(),
            valueString: record.lab_results
          }
        });
      }
    });

    const bundle = {
      resourceType: 'Bundle',
      id: bundleId,
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: entries
    };

    return NextResponse.json(bundle);

  } catch (error: any) {
    console.error('FHIR Export error:', error);
    return NextResponse.json({ error: 'Failed to generate FHIR vault data' }, { status: 500 });
  }
}
