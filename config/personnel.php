<?php

use App\Enums\UserRole;

$base = [
    ['user-1', 'CORE-001', 'EMP-001', 'Mara Villanueva', 'mara.villanueva@alibaton.com', 'System Administrator', 'Administration', UserRole::Admin, 'Employee', null],
    ['user-2', 'CORE-002', 'EMP-002', 'Alvin Custodio', 'alvin.custodio@alibaton.com', 'System Administrator', 'Information Technology', UserRole::Admin, 'Employee', null],
    ['user-4', 'CORE-014', 'EMP-004', 'Celso Ramirez', 'celso.ramirez@alibaton.com', 'HR Business Partner', 'Human Resources', UserRole::HR, 'Employee', null],
    ['user-5', 'CORE-112', 'EMP-005', 'Nina Soriano', 'nina.soriano@alibaton.com', 'Finance Staff', 'Finance', UserRole::User, 'Employee', 'user-gen-11'],
    ['user-6', 'CORE-204', 'TRN-001', 'Elaine Bautista', 'elaine.bautista@alibaton.com', 'Graduate Trainee', 'Operations', UserRole::User, 'Trainee', 'user-gen-10'],
    ['user-8', 'CORE-154', 'EMP-006', 'Miguel Santos', 'miguel.santos@alibaton.com', 'Safety Officer', 'Safety & Compliance', UserRole::User, 'Employee', 'user-gen-13'],
    ['user-10', 'CORE-027', 'EMP-008', 'Grace Fernandez', 'grace.fernandez@alibaton.com', 'Training Officer', 'Human Resources', UserRole::HR, 'Employee', 'user-4'],
    ['user-12', 'CORE-238', 'EMP-010', 'Katrina Buenaventura', 'katrina.buenaventura@alibaton.com', 'HR Business Partner', 'Human Resources', UserRole::HR, 'Employee', 'user-4'],
];

$operational = [
    ['Luis Gomez', 'Crane Operations', 'Crane Operator'],
    ['Sofia Reyes', 'Logistics', 'Logistics Coordinator'],
    ['Mateo Cruz', 'Operations', 'Operations Coordinator'],
    ['Isabella Torres', 'Finance', 'Finance Analyst'],
    ['Lucas Flores', 'Contracts', 'Contracts Officer'],
    ['Mia Ramos', 'Safety & Compliance', 'Safety Inspector'],
    ['Gabriel Morales', 'Administration', 'Administrative Assistant'],
    ['Camila Ortiz', 'Information Technology', 'IT Support Specialist'],
    ['Jose Castillo', 'Crane Operations', 'Crane Operations Supervisor'],
    ['Elena Chavez', 'Logistics', 'Logistics Supervisor'],
    ['Antonio Ruiz', 'Operations', 'Operations Supervisor'],
    ['Valeria Herrera', 'Finance', 'Finance Manager'],
    ['Carlos Medina', 'Contracts', 'Contracts & Compliance Supervisor'],
    ['Mariana Aguilar', 'Safety & Compliance', 'Safety Supervisor'],
    ['Jorge Vargas', 'Administration', 'Administrative Services Supervisor'],
    ['Lucia Castro', 'Information Technology', 'IT Operations Supervisor'],
    ['Pedro Salazar', 'Crane Operations', 'Rigger and Signalperson'],
    ['Valentina Guzman', 'Logistics', 'Dispatch Coordinator'],
    ['Juan Pena', 'Operations', 'Project Site Coordinator'],
    ['Ximena Rojas', 'Finance', 'Accounts Payable Specialist'],
    ['Diego Mendez', 'Contracts', 'Contract Documentation Specialist'],
    ['Mariana Silva', 'Safety & Compliance', 'Safety Compliance Specialist'],
    ['Alejandro Rios', 'Administration', 'Records Coordinator'],
    ['Daniela Navarro', 'Information Technology', 'Systems Analyst'],
    ['Fernando Delgado', 'Crane Operations', 'Crane Maintenance Coordinator'],
    ['Victoria Nunez', 'Operations', 'Project Controls Coordinator'],
    ['Ricardo Padilla', 'Logistics', 'Fleet Scheduling Coordinator'],
];

$managerByDepartment = [
    'Crane Operations' => 'user-gen-8',
    'Logistics' => 'user-gen-9',
    'Operations' => 'user-gen-10',
    'Finance' => 'user-gen-11',
    'Contracts' => 'user-gen-12',
    'Safety & Compliance' => 'user-gen-13',
    'Administration' => 'user-gen-14',
    'Information Technology' => 'user-gen-15',
];

$supervisorIndexes = range(8, 15);
$people = $base;

foreach ($operational as $index => [$name, $department, $position]) {
    $key = "user-gen-{$index}";
    $people[] = [
        $key,
        'CORE-GEN-'.$index,
        'EMP-1'.str_pad((string) $index, 2, '0', STR_PAD_LEFT),
        $name,
        strtolower(str_replace(' ', '.', $name)).'@alibaton.com',
        $position,
        $department,
        UserRole::User,
        'Employee',
        in_array($index, $supervisorIndexes, true) ? null : $managerByDepartment[$department],
    ];
}

return collect($people)->map(function (array $person): array {
    [$key, $coreId, $personnelId, $name, $email, $position, $department, $role, $personType, $managerKey] = $person;

    return [
        'personnel_key' => $key,
        'core_person_id' => $coreId,
        'employee_or_trainee_id' => $personnelId,
        'name' => $name,
        'email' => $email,
        'position' => $position,
        'department' => $department,
        'role' => $role,
        'person_type' => $personType,
        'employment_status' => $personType,
        'manager_key' => $managerKey,
        'evaluator_capable' => $key === 'user-4' || str_contains($position, 'Supervisor') || str_contains($position, 'Manager'),
    ];
})->all();
