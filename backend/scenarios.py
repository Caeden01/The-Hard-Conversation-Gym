"""Pre-built clinical conversation scenarios."""

from dataclasses import dataclass, field


@dataclass
class PatientProfile:
    name: str
    age: int
    gender: str
    occupation: str
    family_context: str
    emotional_baseline: str  # e.g. "anxious but trusting"
    communication_style: str  # e.g. "direct, asks many questions"
    backstory: str


@dataclass
class Scenario:
    id: str
    title: str
    description: str
    difficulty: int  # 1-5
    skills_tested: list[str]
    estimated_minutes: int
    patient: PatientProfile
    clinical_context: str  # what happened medically
    clinician_role: str  # who the user is playing
    opening_line: str  # patient's first line when clinician enters
    spikes_notes: dict[str, str] = field(default_factory=dict)


SCENARIOS: dict[str, Scenario] = {
    "pancreatic_cancer": Scenario(
        id="pancreatic_cancer",
        title="Stage 4 Pancreatic Cancer Diagnosis",
        description="You must tell a 45-year-old the biopsy confirmed Stage 4 pancreatic cancer.",
        difficulty=4,
        skills_tested=["Delivering terminal diagnosis", "Managing shock response", "Discussing prognosis"],
        estimated_minutes=15,
        patient=PatientProfile(
            name="Maria Santos",
            age=45,
            gender="female",
            occupation="Elementary school teacher",
            family_context="Married, two children ages 8 and 12. Husband is waiting in the lobby.",
            emotional_baseline="anxious but trusting",
            communication_style="Asks direct questions, wants honest answers, but becomes overwhelmed by medical jargon",
            backstory="Maria came in three weeks ago with persistent abdominal pain and weight loss. She's been anxious about the biopsy results and has been reading online. She suspects something is seriously wrong but is hoping it's treatable.",
        ),
        clinical_context="Biopsy confirmed Stage 4 pancreatic adenocarcinoma with liver metastases. Median survival 3-6 months. Palliative chemotherapy may extend to 6-11 months. No curative options.",
        clinician_role="You are Dr. Chen, the gastroenterologist who performed the biopsy. You have met Maria twice before and she trusts you.",
        opening_line="*Maria is sitting on the exam table, fidgeting with her phone* Oh, Dr. Chen, thank you for seeing me so quickly. I've been going crazy waiting for these results. My husband wanted to come in but I told him to wait outside... I think I need to hear this alone first. So... what did the biopsy show?",
        spikes_notes={
            "S": "Patient is alone; husband in lobby. Room is private. Consider if she wants support person.",
            "P": "She suspects something serious. Has been researching online. Ask what she's been thinking.",
            "I": "She's asking directly. She wants to know. But check how much detail she wants.",
            "K": "Use a warning shot before the diagnosis. Avoid leading with statistics.",
            "E": "She will likely be in shock. Allow silence. Don't rush to next steps.",
            "S": "Eventually discuss palliative chemo options, palliative care, and whether to bring husband in.",
        },
    ),
    "surgery_death": Scenario(
        id="surgery_death",
        title="Post-Surgical Death Notification",
        description="A patient's family needs to know their mother didn't survive surgery.",
        difficulty=5,
        skills_tested=["Death notification", "Managing family grief", "Answering difficult questions"],
        estimated_minutes=15,
        patient=PatientProfile(
            name="David and Sarah Park",
            age=38,
            gender="male",
            occupation="David is an accountant, Sarah is a nurse",
            family_context="Adult children of the patient, Helen Park (72). David is the healthcare proxy. Sarah works at a different hospital.",
            emotional_baseline="David is controlled but fragile; Sarah is already fearful",
            communication_style="David wants facts and control; Sarah understands medical language and may challenge you",
            backstory="Their mother Helen, 72, went in for elective cardiac valve replacement. She was otherwise healthy and the family expected a routine outcome. Helen died from massive hemorrhage during the procedure.",
        ),
        clinical_context="Helen Park, 72, died during elective mitral valve replacement due to uncontrolled hemorrhage when the aorta was inadvertently injured. Despite 45 minutes of resuscitation, she could not be saved. This was a known but rare complication (mentioned in consent).",
        clinician_role="You are Dr. Williams, the cardiac surgeon who performed the operation. You must tell the family.",
        opening_line="*David stands up quickly as you enter the waiting room. Sarah grabs his arm.* Doctor — is she out? How did it go? You said it would be about four hours and it's been five... is everything okay?",
        spikes_notes={
            "S": "Waiting room is semi-public. Move to a private room. Ensure both are seated.",
            "P": "They expect a routine outcome. They have no idea. Don't assume they're prepared.",
            "I": "They're asking directly but expecting good news. A warning shot is critical here.",
            "K": "Say clearly that she died. Avoid euphemisms like 'passed' initially — be clear, then soften.",
            "E": "Expect shock, anger, guilt, blame. Sarah may ask pointed surgical questions. Allow all reactions.",
            "S": "Offer to see their mother. Discuss what happens next. Do NOT rush. Chaplain services.",
        },
    ),
    "treatment_failure": Scenario(
        id="treatment_failure",
        title="Treatment Is No Longer Working",
        description="A young patient learns their treatment is no longer working.",
        difficulty=3,
        skills_tested=["Transitioning to palliative care", "Maintaining hope", "Shared decision-making"],
        estimated_minutes=12,
        patient=PatientProfile(
            name="James Okafor",
            age=28,
            gender="male",
            occupation="Software developer, works remotely",
            family_context="Single, close with his mother who lives in another state. Has a tight friend group.",
            emotional_baseline="intellectualizing, uses humor as defense, secretly terrified",
            communication_style="Deflects with jokes, asks technical questions to stay in control, avoids emotional language",
            backstory="James was diagnosed with Hodgkin lymphoma 18 months ago. He completed first-line chemo and was in remission for 6 months. The cancer returned and second-line treatment with immunotherapy has been ongoing for 3 months. Latest scans show progression.",
        ),
        clinical_context="CT scan shows disease progression despite 3 months of second-line immunotherapy (pembrolizumab). Options: third-line salvage chemo with stem cell transplant (30-40% response rate, significant toxicity) or transition to comfort-focused care. His performance status is still good.",
        clinician_role="You are Dr. Patel, James's oncologist. You've been treating him since diagnosis and have a good rapport.",
        opening_line="*James walks in wearing a gaming headset around his neck* Hey Doc. So what's the verdict on the scans? I told my raid group I might be late tonight so... hopefully this is quick? *nervous laugh*",
        spikes_notes={
            "S": "He's alone and deflecting. The setting is appropriate but check if he wants anyone with him.",
            "P": "He's hoping the immunotherapy is working. He may not have considered it might fail.",
            "I": "He wants the information but is bracing with humor. Match his pace — don't force emotion.",
            "K": "Be honest that the treatment isn't working. Then pause. Don't immediately jump to options.",
            "E": "His humor is a shield. When it cracks, be ready. Don't try to fix it with optimism.",
            "S": "Present both options honestly. Let him process. Offer to schedule follow-up with his mom on the phone.",
        },
    ),
    "child_diagnosis": Scenario(
        id="child_diagnosis",
        title="Serious Chronic Condition in a Child",
        description="Telling a parent their child has a serious chronic condition.",
        difficulty=3,
        skills_tested=["Communicating with parents", "Explaining chronic illness", "Building a care plan together"],
        estimated_minutes=12,
        patient=PatientProfile(
            name="Rachel and Tom Bennett",
            age=35,
            gender="female",
            occupation="Rachel is a marketing manager, Tom is a firefighter",
            family_context="Parents of Lily (7). Lily has a younger brother (4). Rachel's mother had Type 1 diabetes.",
            emotional_baseline="Rachel is anxious and guilt-ridden; Tom is protective and wants action steps",
            communication_style="Rachel asks 'why' questions and blames herself; Tom wants to know what to DO",
            backstory="Lily, 7, was brought in after her teacher noticed she was drinking excessive water, losing weight, and falling asleep in class. Blood work confirmed Type 1 diabetes with an A1C of 11.2%. Parents are in the office together.",
        ),
        clinical_context="Lily Bennett, age 7, newly diagnosed with Type 1 diabetes. A1C 11.2%, positive GAD antibodies. Needs to start insulin immediately. Will need diabetes education, endocrinology follow-up, and school accommodations.",
        clinician_role="You are Dr. Reeves, the pediatrician who ordered the blood work. The parents have been waiting 2 days for results.",
        opening_line="*Rachel is sitting forward in her chair, Tom has his arms crossed* Doctor, please just tell us. Is it diabetes? My mother has it and I saw the signs... I should have brought her in sooner. *Tom puts his hand on her shoulder* Let's just hear what the doctor says, Rach.",
        spikes_notes={
            "S": "Both parents present. Lily is not in the room. Setting is appropriate.",
            "P": "Rachel already suspects diabetes. She has family history context. Tom may know less.",
            "I": "They're ready for the diagnosis. Rachel may need reassurance it's not her fault.",
            "K": "Confirm the diagnosis clearly. Distinguish Type 1 from Type 2 (grandmother's type). This is NOT caused by parenting.",
            "E": "Rachel will feel guilt. Validate that she actually caught it early by recognizing symptoms. Tom needs action items.",
            "S": "Outline the immediate plan: insulin start, diabetes educator, endo referral, school 504 plan. Emphasize Lily can live a full life.",
        },
    ),
    "elderly_decline": Scenario(
        id="elderly_decline",
        title="Goals of Care: Stopping Aggressive Treatment",
        description="Discussing transition to comfort care with an elderly patient who wants to keep fighting.",
        difficulty=4,
        skills_tested=["Goals of care conversation", "Respecting autonomy", "Navigating disagreement"],
        estimated_minutes=15,
        patient=PatientProfile(
            name="Robert 'Bob' Kowalski",
            age=81,
            gender="male",
            occupation="Retired steelworker",
            family_context="Widowed. Has one daughter, Linda, who visits weekly. Close with his VFW buddies.",
            emotional_baseline="proud, stubborn, fears dependency more than death",
            communication_style="Blunt, old-school, doesn't like being talked down to, respects directness",
            backstory="Bob has metastatic colon cancer, diagnosed 2 years ago. He's been through two lines of chemo. His functional status has declined significantly in the past month — needs help with daily activities, lost 20 pounds, in and out of the hospital. He insists on continuing treatment because 'quitting is not in my DNA.'",
        ),
        clinical_context="Stage 4 colon cancer with peritoneal carcinomatosis. Failed two chemo regimens. ECOG performance status 3. Recent hospitalization for bowel obstruction. Third-line chemo has <5% response rate and high toxicity risk. Hospice referral is medically appropriate.",
        clinician_role="You are Dr. Nguyen, Bob's oncologist for the past 2 years. He respects you but will push back hard.",
        opening_line="*Bob is sitting in the chair rather than the exam table — he hates feeling like a patient* Doc, I know what you're going to say. But I'm not ready to throw in the towel. My buddy Frank did that third chemo thing and got two more years. I've still got fight in me.",
        spikes_notes={
            "S": "He's in your office, comfortable. He's alone — ask if he wants Linda involved.",
            "P": "He knows his cancer is advanced but overestimates what treatment can do. He references a friend's outcome.",
            "I": "He's preemptively defending against what he fears you'll say. Acknowledge his fighting spirit first.",
            "K": "Be honest about the <5% response rate and the risks. Don't sugarcoat but frame it around his values.",
            "E": "His stubbornness is masking fear — of dependency, of being seen as giving up. Explore what he's really afraid of.",
            "S": "Explore what 'fighting' means to him. Hospice IS fighting — for comfort, dignity, time with Linda. Offer a time-limited trial if appropriate.",
        },
    ),
    "mental_health_crisis": Scenario(
        id="mental_health_crisis",
        title="Adolescent Self-Harm Disclosure to Parent",
        description="A social worker must tell a parent about their teenager's self-harm.",
        difficulty=4,
        skills_tested=["Mandatory disclosure", "De-escalation", "Safety planning"],
        estimated_minutes=12,
        patient=PatientProfile(
            name="Karen Mitchell",
            age=48,
            gender="female",
            occupation="Real estate agent",
            family_context="Divorced. Has custody of Emma (16). Emma's father is minimally involved. Karen works long hours and feels guilty about it.",
            emotional_baseline="defensive, guilt-ridden, oscillates between anger and terror",
            communication_style="Initially confrontational ('why didn't anyone tell me sooner'), then collapses into guilt and fear",
            backstory="Emma, 16, has been seeing the school social worker for anxiety. During a session, Emma disclosed she has been cutting her arms for 3 months. Emma begged the social worker not to tell her mother. The social worker must now inform Karen due to safety obligations.",
        ),
        clinical_context="Emma Mitchell, 16, disclosed non-suicidal self-injury (cutting forearms) for 3 months. No suicidal ideation currently. Triggered by parents' divorce and feeling invisible. Emma is terrified her mother will overreact. A safety plan needs to be established.",
        clinician_role="You are Alex Torres, the school social worker. You've been seeing Emma for 6 weeks. You must now tell Karen about the self-harm while maintaining Emma's trust as much as possible.",
        opening_line="*Karen rushes in, still in her work blazer, looking irritated* I got your message that this was urgent. Is Emma in trouble? I had to cancel a showing for this. What's going on?",
        spikes_notes={
            "S": "Private office at school. Karen is rushed and stressed. Slow the pace. Offer water, a seat.",
            "P": "Karen doesn't know about the self-harm. She may not know Emma is struggling this much.",
            "I": "Karen needs this information but isn't prepared. Use a compassionate warning shot.",
            "K": "Be clear: Emma is cutting herself. Explain non-suicidal self-injury. Frame it as a coping mechanism, not a suicide attempt.",
            "E": "Karen will cycle through anger, guilt, and fear. Don't defend — validate. She may attack you for not telling her sooner.",
            "S": "Safety plan: therapy referral, removing access to means, how to talk to Emma tonight without interrogating her. Emphasize partnership.",
        },
    ),
}


def get_scenario(scenario_id: str) -> Scenario | None:
    return SCENARIOS.get(scenario_id)


def list_scenarios() -> list[dict]:
    return [
        {
            "id": s.id,
            "title": s.title,
            "description": s.description,
            "difficulty": s.difficulty,
            "skills_tested": s.skills_tested,
            "estimated_minutes": s.estimated_minutes,
            "clinician_role": s.clinician_role,
            "patient_name": s.patient.name,
            "patient_age": s.patient.age,
        }
        for s in SCENARIOS.values()
    ]
