/**
 * Hand-authored schema definitions for IRPG forms and checklists.
 *
 * These are pure data structures – no UI logic lives here.
 * Five forms are tied to the bundled IRPG PDF (irpgOnly: true);
 * the Weather form is available for any document.
 *
 * relatedPage values correspond to the IRPG (PMS 461) page numbers and can
 * be adjusted if a newer edition renumbers those sections.
 */

import type { FormSchema } from '@/types';

// ── 1. Size-Up Report ────────────────────────────────────────────────────

const sizeupReport: FormSchema = {
  id: 'irpg-sizeup',
  title: 'Size-Up Report',
  irpgOnly: true,
  relatedPage: 4,
  description: 'Systematic assessment of an incident used to communicate fire status and resource needs.',
  sections: [
    {
      id: 'situation',
      title: 'Situation',
      fields: [
        { id: 'incident-name', label: 'Incident Name', type: 'text', placeholder: 'Enter incident name' },
        { id: 'location', label: 'Location / Legal Description', type: 'text', placeholder: 'T__ R__ S__' },
        { id: 'jurisdiction', label: 'Jurisdiction / Unit', type: 'text', placeholder: 'Enter jurisdiction' },
        { id: 'date-time', label: 'Date / Time Reported', type: 'text', placeholder: 'MM/DD/YYYY HH:MM' },
        { id: 'reporter', label: 'Reported By', type: 'text', placeholder: 'Name / Radio ID' },
      ],
    },
    {
      id: 'fire-behavior',
      title: 'Fire Behavior',
      fields: [
        { id: 'fuel-type', label: 'Fuel Type', type: 'text', placeholder: 'e.g. Grass, Brush, Timber' },
        { id: 'slope', label: 'Slope (%)', type: 'number', placeholder: '0–100' },
        { id: 'aspect', label: 'Aspect', type: 'text', placeholder: 'e.g. SW' },
        { id: 'wind-dir', label: 'Wind Direction', type: 'text', placeholder: 'e.g. SW' },
        { id: 'wind-speed', label: 'Wind Speed (mph)', type: 'number', placeholder: '0' },
        { id: 'rh', label: 'Relative Humidity (%)', type: 'number', placeholder: '0–100' },
        { id: 'temp', label: 'Temperature (°F)', type: 'number', placeholder: '0' },
        { id: 'fire-size', label: 'Estimated Size (acres)', type: 'number', placeholder: '0' },
        { id: 'rate-of-spread', label: 'Rate of Spread', type: 'text', placeholder: 'Slow / Moderate / Fast' },
      ],
    },
    {
      id: 'resources',
      title: 'Resources',
      fields: [
        { id: 'on-scene', label: 'Resources On Scene', type: 'textarea', placeholder: 'List crews, engines, aircraft…' },
        { id: 'ordered', label: 'Resources Ordered / Needed', type: 'textarea', placeholder: 'List additional resources requested…' },
      ],
    },
    {
      id: 'objectives',
      title: 'Priorities & Objectives',
      fields: [
        { id: 'life-safety', label: 'Life Safety Considerations', type: 'textarea', placeholder: 'Threats to public / firefighter safety…' },
        { id: 'objectives', label: 'Incident Objectives', type: 'textarea', placeholder: 'Containment strategy, tactics…' },
        { id: 'additional', label: 'Additional Notes', type: 'textarea', placeholder: '' },
      ],
    },
  ],
};

// ── 2. Risk Management Process ───────────────────────────────────────────

const riskManagement: FormSchema = {
  id: 'irpg-risk',
  title: 'Risk Management Process',
  irpgOnly: true,
  relatedPage: 2,
  description: 'Five-step risk management process for evaluating and mitigating operational hazards.',
  sections: [
    {
      id: 'step1',
      title: 'Step 1 – Situation Awareness',
      fields: [
        { id: 'current-situation', label: 'Current Situation', type: 'textarea', placeholder: 'What are you doing? What is changing?' },
        { id: 'lookout', label: 'LCES in Place?', type: 'checkbox' },
      ],
    },
    {
      id: 'step2',
      title: 'Step 2 – Hazard Assessment',
      fields: [
        { id: 'hazards', label: 'Identified Hazards', type: 'textarea', placeholder: 'List all hazards present…' },
        {
          id: 'hazard-checklist',
          label: 'Common Hazard Indicators',
          type: 'checklist',
          options: [
            'Fire not scouted / sized up',
            'Safety zones and escape routes not identified',
            'Unfamiliar with weather / local factors affecting fire behavior',
            'No communication link with supervisor / forces',
            'Constructing line without safe anchor point',
            'Unburned fuel between firefighters and fire',
            'Terrain or fuels making escape to safety zones difficult',
            'Suppression tactics change without notification to all crews',
          ],
        },
      ],
    },
    {
      id: 'step3',
      title: 'Step 3 – Hazard Control',
      fields: [
        { id: 'controls', label: 'Controls / Mitigations', type: 'textarea', placeholder: 'How will each hazard be controlled?' },
      ],
    },
    {
      id: 'step4',
      title: 'Step 4 – Decision Point',
      fields: [
        { id: 'risk-acceptable', label: 'Is the risk acceptable to proceed?', type: 'checkbox' },
        { id: 'decision-notes', label: 'Decision Notes', type: 'textarea', placeholder: 'Justify proceed / don\'t proceed…' },
      ],
    },
    {
      id: 'step5',
      title: 'Step 5 – Evaluate',
      fields: [
        { id: 'evaluation', label: 'Post-Action Evaluation', type: 'textarea', placeholder: 'How did it go? Lessons learned?' },
      ],
    },
  ],
};

// ── 3. LCES ──────────────────────────────────────────────────────────────

const lces: FormSchema = {
  id: 'irpg-lces',
  title: 'LCES',
  irpgOnly: true,
  relatedPage: 1,
  description: 'Lookouts – Communications – Escape Routes – Safety Zones. Complete before engaging.',
  sections: [
    {
      id: 'lookouts',
      title: 'Lookouts',
      fields: [
        { id: 'lookout-names', label: 'Lookout Name(s) / Radio ID', type: 'text', placeholder: 'Who is the lookout?' },
        { id: 'lookout-position', label: 'Lookout Position(s)', type: 'textarea', placeholder: 'Where are they posted?' },
        { id: 'lookout-triggers', label: 'Trigger Points / Activation Conditions', type: 'textarea', placeholder: 'What will cause an alert?' },
      ],
    },
    {
      id: 'communications',
      title: 'Communications',
      fields: [
        { id: 'radio-freq', label: 'Radio Frequency / Channel', type: 'text', placeholder: 'e.g. TAC-1, Ch 7' },
        { id: 'signal-plan', label: 'Signal Plan / Alert Signal', type: 'text', placeholder: 'e.g. "Whistle 3x = evacuate"' },
        { id: 'backup-comms', label: 'Backup Communications', type: 'text', placeholder: 'e.g. cell, satellite, runner' },
      ],
    },
    {
      id: 'escape-routes',
      title: 'Escape Routes',
      fields: [
        { id: 'primary-route', label: 'Primary Escape Route', type: 'textarea', placeholder: 'Describe route, landmarks, direction…' },
        { id: 'alternate-route', label: 'Alternate Escape Route', type: 'textarea', placeholder: 'Describe alternate route…' },
        { id: 'travel-time', label: 'Estimated Travel Time to Safety Zone', type: 'text', placeholder: 'e.g. 5 min' },
      ],
    },
    {
      id: 'safety-zones',
      title: 'Safety Zones',
      fields: [
        { id: 'primary-sz', label: 'Primary Safety Zone', type: 'textarea', placeholder: 'Location, size, description…' },
        { id: 'alternate-sz', label: 'Alternate Safety Zone', type: 'textarea', placeholder: 'Location, size, description…' },
        { id: 'sz-adequate', label: 'Safety zone adequate for all personnel?', type: 'checkbox' },
      ],
    },
  ],
};

// ── 4. Downhill Fireline Construction Checklist ──────────────────────────

const downhillChecklist: FormSchema = {
  id: 'irpg-downhill',
  title: 'Downhill Fireline Construction Checklist',
  irpgOnly: true,
  relatedPage: 6,
  description: 'All conditions must be met and approved before downhill line construction begins.',
  sections: [
    {
      id: 'conditions',
      title: 'Go / No-Go Conditions',
      fields: [
        {
          id: 'conditions-checklist',
          label: 'All conditions must be checked before proceeding',
          type: 'checklist',
          options: [
            'Conditions at bottom of hill allow a successful burnout',
            'Fuels between the fireline and fire edge will burn out at night or under predicted weather conditions',
            'Spot fire potential is low',
            'Crew can be pulled out before fire reaches critical stage',
            'Holding forces are in place at the bottom',
            'There is an anchor point at the top of the line',
            'IC / Division Supervisor has briefed all crews on the plan and hazards',
            'All crews have identified escape routes and safety zones',
            'Experienced personnel are directing construction',
            'Communications established with IC and lookouts',
          ],
        },
      ],
    },
    {
      id: 'approval',
      title: 'Authorization',
      fields: [
        { id: 'approving-official', label: 'Approving Official (name / position)', type: 'text', placeholder: 'Who authorized construction?' },
        { id: 'approval-time', label: 'Time of Approval', type: 'text', placeholder: 'HH:MM' },
        { id: 'safety-briefing', label: 'Safety briefing completed with all personnel?', type: 'checkbox' },
        { id: 'notes', label: 'Notes / Conditions', type: 'textarea', placeholder: 'Any site-specific notes or additional conditions…' },
      ],
    },
  ],
};

// ── 5. Medical Incident Report ───────────────────────────────────────────

const medicalReport: FormSchema = {
  id: 'irpg-medical',
  title: 'Medical Incident Report',
  irpgOnly: true,
  relatedPage: 14,
  description: 'Record patient information, assessment, treatment, and disposition for medical incidents on the fireline.',
  sections: [
    {
      id: 'patient',
      title: 'Patient Information',
      fields: [
        { id: 'patient-name', label: 'Name (optional)', type: 'text', placeholder: 'Last, First' },
        { id: 'age', label: 'Age', type: 'number', placeholder: '' },
        { id: 'gender', label: 'Gender', type: 'text', placeholder: 'M / F / Other' },
        { id: 'unit', label: 'Crew / Assignment', type: 'text', placeholder: '' },
      ],
    },
    {
      id: 'incident-details',
      title: 'Incident Details',
      fields: [
        { id: 'date', label: 'Date', type: 'date' },
        { id: 'time', label: 'Time of Incident', type: 'time' },
        { id: 'location', label: 'Location', type: 'text', placeholder: 'GPS / description' },
        { id: 'mechanism', label: 'Mechanism of Injury / Illness', type: 'textarea', placeholder: 'How did this happen?' },
      ],
    },
    {
      id: 'assessment',
      title: 'Patient Assessment',
      fields: [
        { id: 'chief-complaint', label: 'Chief Complaint', type: 'textarea', placeholder: 'Primary complaint in patient\'s words…' },
        { id: 'mental-status', label: 'Mental Status (AVPU)', type: 'text', placeholder: 'Alert / Verbal / Pain / Unresponsive' },
        { id: 'airway', label: 'Airway', type: 'text', placeholder: 'Patent / Obstructed' },
        { id: 'breathing', label: 'Breathing', type: 'text', placeholder: 'Normal / Labored / Absent' },
        { id: 'circulation', label: 'Circulation / Bleeding', type: 'text', placeholder: 'Normal / Controlled / Uncontrolled' },
      ],
    },
    {
      id: 'vitals',
      title: 'Vital Signs',
      fields: [
        { id: 'pulse', label: 'Pulse (bpm)', type: 'number', placeholder: '' },
        { id: 'resp', label: 'Respirations (per min)', type: 'number', placeholder: '' },
        { id: 'bp', label: 'Blood Pressure', type: 'text', placeholder: 'e.g. 120/80' },
        { id: 'spo2', label: 'SpO₂ (%)', type: 'number', placeholder: '' },
        { id: 'temp', label: 'Temperature (°F)', type: 'number', placeholder: '' },
        { id: 'gcs', label: 'GCS Score', type: 'number', placeholder: '3–15' },
      ],
    },
    {
      id: 'treatment',
      title: 'Treatment',
      fields: [
        { id: 'treatments', label: 'Treatments Given', type: 'textarea', placeholder: 'List interventions, medications, first aid…' },
        { id: 'responder', label: 'Treated By', type: 'text', placeholder: 'Name / certification level' },
      ],
    },
    {
      id: 'disposition',
      title: 'Disposition',
      fields: [
        { id: 'disposition', label: 'Disposition', type: 'text', placeholder: 'e.g. Transported, Refused, Released' },
        { id: 'transport-to', label: 'Transported To', type: 'text', placeholder: 'Hospital / clinic name' },
        { id: 'transport-time', label: 'Transport Time', type: 'text', placeholder: 'HH:MM' },
        { id: 'notes', label: 'Additional Notes', type: 'textarea', placeholder: '' },
      ],
    },
  ],
};

// ── 6. Weather ───────────────────────────────────────────────────────────

const weatherForm: FormSchema = {
  id: 'weather',
  title: 'Weather',
  irpgOnly: false,
  description: 'Record on-site weather observations. Use the Set buttons to auto-fill location and time.',
  sections: [
    {
      id: 'site',
      title: 'Site Information',
      fields: [
        {
          id: 'location',
          label: 'Site Location',
          type: 'text',
          placeholder: 'Coordinates or description',
          deviceAction: {
            type: 'geolocation',
            buttonLabel: 'Set Location',
            allowManualOverride: true,
          },
        },
        {
          id: 'date',
          label: 'Date',
          type: 'date',
          deviceAction: {
            type: 'currentDate',
            buttonLabel: 'Set Today',
            allowManualOverride: true,
          },
        },
        {
          id: 'time',
          label: 'Time',
          type: 'time',
          deviceAction: {
            type: 'currentTime',
            buttonLabel: 'Set Now',
            allowManualOverride: true,
          },
        },
        { id: 'observer', label: 'Observer', type: 'text', placeholder: 'Name / call sign' },
        { id: 'elevation', label: 'Elevation (ft)', type: 'number', placeholder: '0' },
      ],
    },
    {
      id: 'wind',
      title: 'Wind',
      fields: [
        { id: 'wind-dir', label: 'Wind Direction', type: 'text', placeholder: 'e.g. SW' },
        { id: 'wind-speed', label: 'Wind Speed (mph)', type: 'number', placeholder: '0' },
        { id: 'wind-gusts', label: 'Wind Gusts (mph)', type: 'number', placeholder: '0' },
      ],
    },
    {
      id: 'atmospheric',
      title: 'Atmospheric Conditions',
      fields: [
        { id: 'temp', label: 'Temperature (°F)', type: 'number', placeholder: '0' },
        { id: 'rh', label: 'Relative Humidity (%)', type: 'number', placeholder: '0–100' },
        { id: 'dew-point', label: 'Dew Point (°F)', type: 'number', placeholder: '0' },
        { id: 'cloud-cover', label: 'Cloud Cover (%)', type: 'number', placeholder: '0–100' },
        { id: 'precipitation', label: 'Precipitation (in)', type: 'number', placeholder: '0.00' },
      ],
    },
    {
      id: 'fire-wx',
      title: 'Fire Weather',
      fields: [
        { id: 'ffmc', label: 'Fine Fuel Moisture (%)', type: 'number', placeholder: '0' },
        { id: 'stability', label: 'Atmospheric Stability', type: 'text', placeholder: 'Stable / Unstable / Neutral' },
        { id: 'mixing-height', label: 'Mixing Height (ft AGL)', type: 'number', placeholder: '0' },
        { id: 'haines', label: 'Haines Index', type: 'number', placeholder: '2–6' },
      ],
    },
    {
      id: 'remarks',
      title: 'Remarks',
      fields: [
        { id: 'remarks', label: 'Remarks / Observations', type: 'textarea', placeholder: 'Any unusual weather patterns or notes…' },
      ],
    },
  ],
};

// ── Exports ──────────────────────────────────────────────────────────────

/** All IRPG-specific forms (irpgOnly: true) plus shared forms. */
export const IRPG_FORMS: FormSchema[] = [
  sizeupReport,
  riskManagement,
  lces,
  downhillChecklist,
  medicalReport,
  weatherForm,
];
