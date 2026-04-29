import { NextResponse } from 'next/server';
import { getMedicalRecords, getPatients } from '@/lib/data';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { patientId, type, provider, diagnosis, notes, labResults } = body;

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    const recordsFile = path.join(process.cwd(), 'data', 'medical_records.csv');
    const csvContent = fs.readFileSync(recordsFile, 'utf-8');

    // Get existing records to generate the next record ID
    const existing = await getMedicalRecords(patientId);
    const allRecordsRaw = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    const allRecords = allRecordsRaw.data as any[];

    // Generate next record ID
    const maxId = allRecords.reduce((max, r) => {
      const num = parseInt((r.record_id || 'R0').replace('R', ''), 10);
      return num > max ? num : max;
    }, 99);
    const newRecordId = `R${maxId + 1}`;

    const today = new Date().toISOString().split('T')[0];

    const newRecord = {
      record_id: newRecordId,
      patient_id: patientId,
      date: today,
      type: type || 'Document Scan',
      provider: provider || 'nalam.ai OCR Engine',
      diagnosis: diagnosis || '',
      notes: notes || '',
      lab_results: labResults || '',
    };

    allRecords.push(newRecord);
    const updatedCsv = Papa.unparse(allRecords);
    fs.writeFileSync(recordsFile, updatedCsv, 'utf-8');

    return NextResponse.json({ success: true, record: newRecord });
  } catch (e: any) {
    console.error('Failed to add record:', e);
    return NextResponse.json({ error: e.message || 'Failed to add record' }, { status: 500 });
  }
}
