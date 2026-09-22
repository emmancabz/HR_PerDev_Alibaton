# Competency Management, Role Profile, and Assessment Governance Guideline

Document ID: ALB-PND-GDL-014
Document Type: Internal Guideline
Version: 1.0
Effective Date: 2026-09-11
Document Owner: Human Resources / Performance & Development
Approval Authority: HR / Authorized Management
Review Cycle: Annual or upon material organizational, role, policy, regulatory, or process change
Status: Active Internal Competency Reference (Project Baseline)
Related Competency Records: Competency Library, Role Profiles, Competency Assessments, Development Actions, Reassessments
Supporting Baseline: ALB-PND-REF-015; ALIBATON_COMPETENCY_REFERENCE_BASELINE_V1.json

Governance note: This is an interim internal reference created for the Performance & Development system because a complete client-issued competency framework, role requirement matrix, and controlled job-description set were not available to the project team. It must not be represented as an official Alibaton Construction Inc. policy. If Alibaton later supplies an official policy, competency framework, job description, SOP, role matrix, certification requirement, or other controlled source covering the same subject, the official client-issued source supersedes this project baseline and affected competency definitions, role profiles, assessments, development actions, and learning/training references must be reviewed and versioned rather than silently overwritten.

## 1. Purpose
Defines the interim governance model used by the Performance & Development system to create, approve, apply, assess, maintain, and version competency requirements while official client-issued competency documents are unavailable or incomplete.

## 2. Source Hierarchy
Competency requirements should be based on the strongest available organizational evidence in this order:

1. Client-issued controlled policies, SOPs, job descriptions, competency frameworks, licenses/certification requirements, and approved organizational standards.
2. Approved role responsibilities, department processes, training requirements, safety/compliance controls, and documented management expectations.
3. Existing internal project reference documents in this library that describe the work, controls, risks, responsibilities, or learning expectations relevant to the capability.
4. A governed interim project baseline approved for system demonstration or implementation when the client has not supplied sufficient documentation.

A role profile must never be described as an official client standard merely because it exists in the system.

## 3. Competency Library
The Competency Library defines the capability itself. Each competency should maintain, where applicable:

- unique competency code and name;
- category;
- definition;
- five-level behavioral indicators;
- appropriate assessment methods;
- accepted evidence types;
- reassessment interval;
- active/inactive status;
- version and history.

Position-specific required levels do not belong in the competency definition. They belong in a Role Profile.

## 4. Five-Level Proficiency Model
The system uses the following governed five-level model:

| Level | Label | General meaning |
| --- | --- | --- |
| 1 | Awareness | Recognizes the capability, terminology, basic rules, risks, and escalation points; normally requires guidance. |
| 2 | Basic | Performs routine or controlled tasks with direct guidance or supervision. |
| 3 | Intermediate | Performs normal role tasks independently and handles common exceptions within authority. |
| 4 | Advanced | Handles complex work, exercises judgment, reviews or guides others, and manages significant exceptions or risk. |
| 5 | Expert | Acts as a subject-matter authority, defines or improves practices, and handles exceptional or high-complexity situations. |

Competency-specific behavioral indicators in the governed Competency Library take precedence over these general descriptions.

## 5. Role Profile Purpose
A Role Profile defines which competencies are required for a specific organizational role/context and the minimum required level for each capability.

Role Profiles are not created per employee. A governed active profile is reusable by all personnel whose current canonical organizational context legitimately matches that profile.

## 6. Role Profile Applicability
Normal applicability is resolved from the employee's current organizational record, primarily:

- position;
- department or organizational unit;
- legitimate role context where required.

The system should automatically resolve the active matching profile where possible. Individual hardcoded employee-to-profile mappings should not be used as the normal model.

If two roles share the same title but operate under materially different organizational contexts, separate profiles may exist, such as a System Administrator profile in Administration and another in Information Technology.

## 7. Creating a New Role Profile
Admin/HR or other authorized governance personnel use **New Role Profile** only when:

- a new organizational role is introduced;
- an existing role has no approved competency baseline;
- responsibilities materially change;
- new safety, compliance, technical, regulatory, or operational requirements apply;
- a controlled source requires a revised competency standard.

The profile should be based on the strongest available source hierarchy in Section 2 and should record a defensible reason for each required capability and level.

## 8. Required-Level Selection
Required proficiency must be proportionate to actual role responsibility, task complexity, risk exposure, independence, and supervisory accountability.

General baseline logic:

- trainee or closely supervised exposure commonly uses Levels 1-2;
- routine independent practitioner or coordinator capability commonly uses Level 3;
- specialist, reviewer, high-risk, or supervisory capability commonly uses Level 4;
- Level 5 should be reserved for genuine expert/authority responsibilities and must not be used merely to make a profile appear more senior.

The exact requirement matrix used by the current project baseline is documented in ALB-PND-REF-015.

## 9. Role Profile Approval and Status
A role profile should pass through governed review before it is treated as the active standard. At minimum, the system should distinguish draft or proposed requirements from an active/published version.

An active profile is treated as the fixed operational standard for matching employees until a governed replacement version becomes effective.

## 10. Versioning and Change Control
Published/active profiles must not be casually edited in a way that rewrites historical assessment meaning.

When a material requirement changes:

1. retain the prior version for historical interpretation;
2. create a new governed version;
3. identify the effective date and reason for change;
4. review affected employees, assessment plans, gaps, and development actions;
5. use the new active version for future/current application as appropriate.

Historical finalized assessments must retain enough profile/version context to show what requirements were in force when the assessment was finalized.

## 11. Assessment Authority
Official employee proficiency comes only from a governed finalized competency assessment or reassessment.

Learning completion, training attendance, certificates, self-ratings, performance scores, or manager comments may provide evidence, but they do not automatically become official competency levels.

Assessment authority must be enforced by the system and limited to authorized assessors/evaluators and governance roles.

## 12. Gap Logic
For a competency requirement with a finalized validated assessment:

**Gap = max(Required Level - Validated Level, 0)**

If no finalized validated assessment exists, the requirement is **Not Assessed**. It must not be treated as Level 0 or automatically counted as a validated competency gap.

## 13. Development and Reassessment
A validated gap may trigger:

- Learning recommendation;
- Training recommendation;
- coaching or supervised development;
- evidence collection;
- post-training or scheduled reassessment.

Completing Learning or Training does not automatically close the competency gap. Improvement becomes official only after governed reassessment/finalization validates a new proficiency level.

## 14. Administrative Use
In normal operations, Admin/HR does not recreate profiles for each employee.

Typical use is:

**Initial or new-role setup → review/approve profile → activate profile → system automatically applies it to matching personnel → assess → identify gaps → development → reassess.**

Admin/HR returns to Role Profile creation/versioning only when organizational requirements materially change.

## 15. Project Baseline Limitation
The current role-profile and proficiency requirements are a controlled project baseline designed to provide consistent, traceable, and defense-ready system behavior while complete official client source documents are unavailable.

Before production organizational adoption, HR/authorized management should validate the profile catalog against official job descriptions, department responsibilities, legal/regulatory obligations, licenses/certifications, and actual operating procedures.

## Document Control
Any material revision must update the version and trigger review of ALB-PND-REF-015, the machine-readable competency baseline, affected role profiles, assessments, Learning/Training mappings, and historical interpretation requirements.

## 16. System-Owned vs. Human-Governed Fields
To reduce repetitive administrative work and prevent conflicting records, the following values are system-owned wherever the source data exists:

- employee-to-role-profile matching from canonical position + department/context + person type;
- role-profile coverage status;
- person type applicability for a role profile when the canonical workforce source is unambiguous;
- current validated proficiency from the latest applicable finalized assessment/reassessment;
- competency gap and gap status;
- reassessment timing after completed Learning/Training, using the governed competency/profile interval;
- Learning/Training completion state received from the owning module;
- Overview and Analytics metrics derived from governed records.

Admin/HR continues to govern the decisions that require accountable human judgment, including competency definitions, required levels, criticality, evidence requirements, assessment governance, assessor authorization, publication/versioning, and exceptional overrides with reason and audit history.

## 17. Canonical Workforce Dependency
For the current project dataset, canonical workforce identity and organizational context are sourced from the governed workforce/personnel records represented by Data B and the synchronized personnel database.

A new Role Profile may only target a position + department/context that exists in the canonical workforce source unless an authorized organizational change first creates that role in the personnel source. The Competency module must not invent a new employee role only to satisfy profile coverage.

Where a deterministic reporting relationship or authorized role-based assessor exists, the system should use it. Exceptional authorized assignment is reserved for cases where the canonical workforce source has no valid automatic assessor path or a documented governance exception requires a different authorized assessor.
