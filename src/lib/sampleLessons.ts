export interface SampleLesson {
  id: string;
  title: string;
  subject: string;
  emoji: string;
  summary: string;
  content: string;
  suggestedQuestion: string;
}

export const SAMPLE_LESSONS: SampleLesson[] = [
  {
    id: 'photosynthesis',
    title: 'Photosynthesis & Cellular Energy',
    subject: 'Biology / Life Sciences',
    emoji: '🌿',
    summary: 'How green plants convert sunlight, water, and CO₂ into glucose and oxygen.',
    suggestedQuestion: 'What is the exact difference between the light reactions in thylakoids and the Calvin cycle in the stroma?',
    content: `Photosynthesis is the fundamental biological process through which green plants, algae, and cyanobacteria transform light energy into chemical energy stored in glucose bonds.

1. Overall Chemical Reaction:
6CO₂ (Carbon Dioxide) + 6H₂O (Water) + Light Energy ➔ C₆H₁₂O₆ (Glucose) + 6O₂ (Oxygen gas).

2. Site of Photosynthesis:
Photosynthesis occurs inside specialized plant cell organelles called chloroplasts. Chloroplasts contain green photosynthetic pigments called chlorophyll, which absorb blue and red wavelengths of light while reflecting green light.

3. Stage 1: The Light-Dependent Reactions
- Location: Thylakoid membranes within the chloroplast.
- Input: Solar photon energy and water (H₂O).
- Process: Photons excite electrons in Chlorophyll Photosystems II and I. Water molecules are split (photolysis), releasing oxygen gas (O₂) as a byproduct.
- Output: Energy-rich carrier molecules ATP (adenosine triphosphate) and NADPH.

4. Stage 2: The Calvin Cycle (Light-Independent Reactions)
- Location: The stroma, the dense fluid-filled space surrounding the thylakoid stacks.
- Input: Carbon dioxide (CO₂) from the atmosphere, ATP, and NADPH produced in Stage 1.
- Process: Carbon fixation catalyzed by the enzyme RuBisCO, followed by reduction and carbohydrate formation.
- Output: High-energy three-carbon sugars (G3P) that combine to form glucose (C₆H₁₂O₆).

Why It Matters:
Photosynthesis is the primary engine of Earth's biosphere, fueling almost all terrestrial food webs and maintaining the atmospheric oxygen levels required for aerobic life.`,
  },
  {
    id: 'newton-laws',
    title: "Newton's Laws of Motion",
    subject: 'Physics',
    emoji: '🍎',
    summary: 'The three core principles governing force, mass, acceleration, and inertia.',
    suggestedQuestion: 'How does friction affect Newton’s first and second laws in everyday vehicles?',
    content: `Isaac Newton formulated three fundamental laws of motion that describe the relationship between physical bodies and the forces acting upon them.

1. First Law of Motion (Law of Inertia):
An object at rest remains at rest, and an object in uniform motion continues moving in a straight line at a constant speed, unless acted upon by a net external force.
- Concept of Inertia: Inertia is the intrinsic resistance of any physical object to a change in its velocity. Inertia depends directly on the object's mass.

2. Second Law of Motion (Fundamental Force Law):
The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass.
- Mathematical Equation: F = m × a (Force = Mass × Acceleration).
- SI Units: Force in Newtons (N), mass in kilograms (kg), acceleration in meters per second squared (m/s²).

3. Third Law of Motion (Action and Reaction):
For every action, there is an equal and opposite reaction force.
- If Object A exerts a force on Object B, Object B simultaneously exerts an equal magnitude force in the opposite direction on Object A.
- Crucial Distinction: Action-reaction pairs act on two DIFFERENT objects, which is why they do not simply cancel each other out.`,
  },
];
