<?php

/* Canonical compatibility adapter for the supplied frontend-backed Competency module. */
return [
    'competency_version' => 1,
    'competencies' => [
        ['id'=>'comp-communication','code'=>'CMP-001','name'=>'Communication','category'=>'Core & Behavioral'],
        ['id'=>'comp-teamwork','code'=>'CMP-002','name'=>'Teamwork','category'=>'Core & Behavioral'],
        ['id'=>'comp-accountability','code'=>'CMP-003','name'=>'Accountability','category'=>'Core & Behavioral'],
        ['id'=>'comp-problem-solving','code'=>'CMP-004','name'=>'Problem Solving','category'=>'Digital & Analytical'],
        ['id'=>'comp-crane-operation','code'=>'CMP-005','name'=>'Crane Operation','category'=>'Functional & Technical'],
        ['id'=>'comp-heavy-equipment','code'=>'CMP-006','name'=>'Heavy Equipment Operation','category'=>'Functional & Technical'],
        ['id'=>'comp-defensive-driving','code'=>'CMP-007','name'=>'Defensive Driving','category'=>'Safety & Compliance'],
        ['id'=>'comp-equipment-inspection','code'=>'CMP-008','name'=>'Equipment Inspection','category'=>'Functional & Technical'],
        ['id'=>'comp-preventive-maintenance','code'=>'CMP-009','name'=>'Preventive Maintenance','category'=>'Functional & Technical'],
        ['id'=>'comp-hazard-identification','code'=>'CMP-010','name'=>'Hazard Identification','category'=>'Safety & Compliance'],
        ['id'=>'comp-safety-compliance','code'=>'CMP-011','name'=>'Safety Procedure Compliance','category'=>'Safety & Compliance'],
        ['id'=>'comp-incident-reporting','code'=>'CMP-012','name'=>'Incident Reporting','category'=>'Safety & Compliance'],
        ['id'=>'comp-site-coordination','code'=>'CMP-013','name'=>'Construction Site Coordination','category'=>'Functional & Technical'],
        ['id'=>'comp-team-leadership','code'=>'CMP-014','name'=>'Team Leadership','category'=>'Leadership & Supervisory'],
        ['id'=>'comp-coaching','code'=>'CMP-015','name'=>'Coaching and Mentoring','category'=>'Leadership & Supervisory'],
        ['id'=>'comp-data-interpretation','code'=>'CMP-016','name'=>'Data Interpretation','category'=>'Digital & Analytical'],
    ],
    'role_profiles' => [
        ['id'=>'profile-safety-officer','name'=>'Safety Officer Competency Profile','position'=>'Safety Officer','department'=>'Safety & Compliance','personType'=>'Employee','version'=>1],
        ['id'=>'profile-crane-supervisor','name'=>'Crane Operations Supervisor Profile','position'=>'Crane Operations Supervisor','department'=>'Crane Operations','personType'=>'Employee','version'=>1],
        ['id'=>'profile-operations-supervisor','name'=>'Operations Supervisor Profile','position'=>'Operations Supervisor','department'=>'Operations','personType'=>'Employee','version'=>1],
        ['id'=>'profile-finance-staff','name'=>'Finance Staff Competency Profile','position'=>'Finance Staff','department'=>'Finance','personType'=>'Employee','version'=>1],
        ['id'=>'profile-training-officer','name'=>'Training Officer Competency Profile','position'=>'Training Officer','department'=>'Human Resources','personType'=>'Employee','version'=>1],
        ['id'=>'profile-graduate-trainee','name'=>'Operations Graduate Trainee Profile','position'=>'Graduate Trainee','department'=>'Operations','personType'=>'Trainee','version'=>1],
    ],
];
