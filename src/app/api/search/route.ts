import { NextResponse } from 'next/server';
import { getMedicalRecords, getAllPatients } from '@/lib/data';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

// Simple tokeniser — splits on whitespace and punctuation, lowercases
function tokenise(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

// Overlap-based relevance score (0–1)
function scoreMatch(record: Record<string, string>, queryTokens: string[]): number {
  const searchableText = [
    record.diagnosis,
    record.notes,
    record.lab_results,
    record.provider,
    record.type,
    record.patient_name,
    record.hospital,
  ].join(' ');

  const textTokens = new Set(tokenise(searchableText));
  let hits = 0;
  for (const qt of queryTokens) {
    if ([...textTokens].some(t => t.includes(qt))) hits++;
  }
  return queryTokens.length > 0 ? hits / queryTokens.length : 0;
}

// Highlight matching substrings with <mark> tags
function highlight(text: string, queryTokens: string[]): string {
  if (!text) return '';
  let result = text;
  for (const qt of queryTokens) {
    const regex = new RegExp(`(${qt})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');
  }
  return result;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const patientId = searchParams.get('patientId');
    const hospital = searchParams.get('hospital');
    const field = searchParams.get('field') || 'all'; // all | diagnosis | notes | labs | provider

    if (!q || q.length < 2) {
      return NextResponse.json({ records: [], total: 0, query: q });
    }

    const queryTokens = tokenise(q);

    // Build doctor-hospital mapping to infer hospital from provider name
    const doctors = await prisma.doctor.findMany();
    const docToHospital: Record<string, string> = {};
    for (const doc of doctors) {
      const docName = decrypt(doc.full_name_enc);
      if (docName) {
        docToHospital[docName] = doc.hospital;
        docToHospital[docName.replace(/^Dr\.\s*/i, '')] = doc.hospital;
      }
    }
    
    function getHospitalForProvider(provider: string) {
       if (!provider) return '';
       for (const [docName, hosp] of Object.entries(docToHospital)) {
         if (provider.includes(docName)) return hosp;
       }
       return provider; // Fallback to provider string (it might already be the hospital desk name)
    }

    // Fetch records — either for one patient or all
    let records: any[] = [];
    let patientMap: Record<string, string> = {};
    
    if (patientId) {
      records = await getMedicalRecords(patientId);
      // Get patient name for single patient
      const patients = await getAllPatients();
      const patient = patients.find(p => p.id === patientId);
      if (patient) {
        records = records.map(r => ({ ...r, patient_name: patient.name }));
      }
    } else {
      const patients = await getAllPatients();
      // Create patient ID to name map
      patientMap = patients.reduce((map, p) => ({ ...map, [p.id]: p.name }), {});
      const nested = await Promise.all(patients.map(p => getMedicalRecords(p.id)));
      records = nested.flat();
      // Attach patient_name to records so it can be searched
      records = records.map(r => ({ ...r, patient_name: patientMap[r.patient_id] }));
    }

    // Attach inferred hospital to all records
    records = records.map(r => ({ ...r, hospital: getHospitalForProvider(r.provider || '') }));

    // Filter by hospital if provided
    if (hospital) {
      records = records.filter(r => r.hospital?.toLowerCase().includes(hospital.toLowerCase()));
    }

    // Score each record
    const scored = records
      .map(r => {
        // Field-specific filtering
        let targetText = '';
        if (field === 'diagnosis')  targetText = r.diagnosis || '';
        else if (field === 'notes') targetText = r.notes || '';
        else if (field === 'labs')  targetText = r.lab_results || '';
        else if (field === 'provider') targetText = r.provider || '';
        else targetText = [r.diagnosis, r.notes, r.lab_results, r.provider, r.type].join(' ');

        const score = scoreMatch({ ...r, _target: targetText }, queryTokens);
        return { ...r, _score: score };
      })
      .filter(r => r._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 50); // max 50 results

    // Attach highlights
    const withHighlights = scored.map(({ _score, ...r }) => ({
      ...r,
      score: _score,
      patient_name: patientMap[r.patient_id] || null,
      highlights: {
        diagnosis:   highlight(r.diagnosis || '',   queryTokens),
        notes:       highlight(r.notes || '',       queryTokens),
        lab_results: highlight(r.lab_results || '', queryTokens),
        provider:    highlight(r.provider || '',    queryTokens),
      },
    }));

    return NextResponse.json({
      records: withHighlights,
      total: withHighlights.length,
      query: q,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
