import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: Request) {
  try {
    const { medication, dosage, patient, records, lang = 'en' } = await request.json();
    if (!medication) return NextResponse.json({ error: 'Missing medication' }, { status: 400 });

    const medWithDosage = dosage ? `${medication} ${dosage}` : medication;
    const langInstruction = lang === 'ta'
      ? 'Write your entire response in Tamil (தமிழில் எழுவும்).'
      : 'Write your response in clear, simple English.';

    // Build patient context
    const patientContext = patient 
      ? `
Patient Profile:
- Age: ${patient.age || 'Unknown'}
- Gender: ${patient.gender || 'Unknown'}
- Blood Type: ${patient.bloodType || 'Unknown'}
- Allergies: ${patient.allergies || 'None reported'}
- Chronic Conditions: ${patient.chronicConditions || 'None reported'}
- Current Medications: ${patient.currentMedications || 'None reported'}
` : 'Patient profile not available';

    // Build medical history context
    const historyContext = records && records.length > 0
      ? `
Recent Medical History:
${records.slice(0, 5).map((r: any) => `- ${r.date}: ${r.diagnosis || r.type} - ${r.provider || ''}`).join('\n')}
` : 'No recent medical history available';

    const prompt = `
You are a clinical pharmacology expert assisting a medical doctor.

A doctor wants to understand how the medicine "${medWithDosage}" affects different body parts for a specific patient.

${patientContext}
${historyContext}

${langInstruction}

Analyze how this medication affects the following body parts:
- brain
- heart
- lungs
- liver
- stomach
- kidneys
- bladder
- vessels (blood vessels)
- muscles
- nerves

For each body part, determine:
1. Whether the effect is beneficial (good), harmful (bad), or neutral (none)
2. A brief explanation (under 15 words) of the effect

IMPORTANT GUIDELINES:
- Mark an organ as "good" ONLY if the drug has a direct therapeutic benefit for that organ (e.g., bronchodilators for lungs, antihypertensives for heart/vessels)
- Mark an organ as "bad" ONLY if there are well-documented, clinically significant side effects or contraindications for that organ
- Mark an organ as "none" if the drug has no significant direct effect on that organ (this is the DEFAULT for most organs)
- Be conservative - if uncertain about an effect, mark it as "none" rather than "bad"
- For common medications (cough syrup, pain relievers, etc.), only mark organs that are actually known to be affected
- Do NOT mark organs as harmful just because the drug passes through them (e.g., liver metabolism is normal, not harmful)
- For poisons/toxic substances, mark affected organs as "bad" with appropriate warnings

Consider:
- The drug's known pharmacological profile and primary mechanism of action
- Well-documented side effects and contraindications
- Potential interactions with patient's current medications
- Patient's chronic conditions and allergies
- Age and gender considerations

Return ONLY a JSON object with this exact structure:
{
  "brain": { "effect": "good|bad|none", "short": "brief explanation" },
  "heart": { "effect": "good|bad|none", "short": "brief explanation" },
  "lungs": { "effect": "good|bad|none", "short": "brief explanation" },
  "liver": { "effect": "good|bad|none", "short": "brief explanation" },
  "stomach": { "effect": "good|bad|none", "short": "brief explanation" },
  "kidneys": { "effect": "good|bad|none", "short": "brief explanation" },
  "bladder": { "effect": "good|bad|none", "short": "brief explanation" },
  "vessels": { "effect": "good|bad|none", "short": "brief explanation" },
  "muscles": { "effect": "good|bad|none", "short": "brief explanation" },
  "nerves": { "effect": "good|bad|none", "short": "brief explanation" }
}

Example for cough syrup:
{
  "lungs": { "effect": "good", "short": "Relieves cough and soothes airways" },
  "brain": { "effect": "none", "short": "No significant effect" },
  "heart": { "effect": "none", "short": "No significant effect" },
  "liver": { "effect": "none", "short": "No significant effect" },
  "stomach": { "effect": "none", "short": "No significant effect" },
  "kidneys": { "effect": "none", "short": "No significant effect" },
  "bladder": { "effect": "none", "short": "No significant effect" },
  "vessels": { "effect": "none", "short": "No significant effect" },
  "muscles": { "effect": "none", "short": "No significant effect" },
  "nerves": { "effect": "none", "short": "No significant effect" }
}
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 800,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '{}';
    
    // Parse the JSON response
    let effects;
    try {
      // Extract JSON from response if it contains extra text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;
      effects = JSON.parse(jsonString);
    } catch (e) {
      console.error('Failed to parse drug effects JSON:', e);
      effects = {};
    }

    return NextResponse.json({ effects });
  } catch (err) {
    console.error('Drug effects analysis error:', err);
    return NextResponse.json({ effects: {} }, { status: 500 });
  }
}
