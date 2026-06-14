import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

export async function POST(request: Request) {
  try {
    const { medication, dosage } = await request.json();
    if (!medication) return NextResponse.json({ effects: {} });

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const medWithDosage = dosage ? `${medication} ${dosage}` : medication;

    const prompt = `
You are a pharmacology API specializing in Indian medicines, TNMSC (Tamil Nadu Medical Services Corporation) generic formulations, and common Indian brand names.

Given a drug name (which may be a generic name, TNMSC generic, or Indian brand name) and optional dosage, return a JSON object mapping the organs it affects to an object containing "effect" ("good" or "bad") and "short" (a brief 3-8 word explanation of the physiological impact).

Valid organ keys are strictly limited to: brain, nerves, lungs, heart, liver, stomach, kidneys, bladder, vessels, muscles.
Only include organs that have a significant known physiological impact. Consider the dosage when provided.
If the substance is unknown or has no distinct effects, return an empty object {}.

Indian/TNMSC generic naming examples you must recognize:
- "Paracetamol IP" / "Dolo 650" / "Crocin" = paracetamol
- "Metformin HCl IP" / "Glycomet" / "Glucophage" = metformin (Type 2 Diabetes)
- "Ciprofloxacin IP" = ciprofloxacin (antibiotic)
- "Amlodipine Besylate IP" / "Amlokind" / "Norvasc" = amlodipine
- "Atenolol IP" = atenolol
- "Telmisartan IP" / "Telma" = telmisartan
- "Glibenclamide IP" / "Daonil" = glibenclamide
- "Cetirizine HCl IP" = cetirizine (antihistamine, used in Dengue/Chikungunya)
- "Chloroquine Phosphate IP" = chloroquine (Chikungunya)
- "Doxycycline HCl IP" = doxycycline (Dengue fever precaution)
- "Ibuprofen IP" / "Brufen" = ibuprofen

Common Tamil Nadu endemic conditions:
- Dengue fever: Paracetamol (first line), Doxycycline, IV Fluids
- Chikungunya: Paracetamol, Ibuprofen, Chloroquine
- Type-2 Diabetes (high prevalence): Metformin, Glibenclamide, Insulin, Voglibose, Sitagliptin
- Hypertension (epidemic levels): Amlodipine, Atenolol, Telmisartan, Ramipril, Losartan

Example input: "Amlodipine 5mg"
Example output: { "heart": { "effect": "good", "short": "Reduces cardiac workload" }, "vessels": { "effect": "good", "short": "Relaxes and widens blood vessels" } }

Example input: "Metformin HCl IP 500mg"
Example output: { "liver": { "effect": "good", "short": "Decreases hepatic glucose production" }, "stomach": { "effect": "bad", "short": "May cause gastrointestinal upset" }, "kidneys": { "effect": "bad", "short": "Risk of lactic acidosis if impaired" } }

Example input: "Dolo 650"
Example output: { "liver": { "effect": "bad", "short": "Risk of hepatotoxicity at high doses" }, "stomach": { "effect": "bad", "short": "Potential gastric irritation" } }

Input: "${medWithDosage}"
Respond ONLY with raw valid JSON, no markdown formatting.
`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let effects = {};
    try {
      effects = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('Failed to parse Groq response:', jsonStr);
    }

    const validKeys = ['brain', 'nerves', 'lungs', 'heart', 'liver', 'stomach', 'kidneys', 'bladder', 'vessels', 'muscles'];
    const sanitizedEffects: Record<string, { effect: 'good' | 'bad', short: string }> = {};
    
    Object.entries(effects).forEach(([key, val]: [string, any]) => {
      const k = key.toLowerCase();
      if (validKeys.includes(k) && val && typeof val === 'object' && (val.effect === 'good' || val.effect === 'bad')) {
        sanitizedEffects[k] = { effect: val.effect, short: val.short || '' };
      }
    });

    return NextResponse.json({ effects: sanitizedEffects });
  } catch (err) {
    console.error('Med effects error:', err);
    return NextResponse.json({ effects: {} });
  }
}
